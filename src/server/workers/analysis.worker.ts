import { Queue, Worker, type Job } from "bullmq";
import { getRedis, publishEvent } from "../lib/redis";
import { db } from "../db/index";
import {
  projects,
  files as filesTable,
  edges as edgesTable,
  analyses as analysesTable,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { parseFile } from "../lib/parser";
import { buildGraph } from "../../shared/lib/graph";
import { explainModule } from "../lib/ai";
import type { IngestedFile } from "../lib/ingest";

// ─── Queue setup ───────────────────────────────────────────────────────────────
export const ANALYSIS_QUEUE_NAME = "analysis";

export interface AnalysisJobData {
  projectId: string;
  projectName: string;
  ingestedFiles: IngestedFile[];
}

export function getAnalysisQueue(): Queue<AnalysisJobData> {
  return new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400 }, // keep completed jobs for 24h
      removeOnFail: { age: 86400 * 7 }, // keep failed jobs for 7 days
    },
  });
}

// ─── Worker logic ──────────────────────────────────────────────────────────────
async function processAnalysisJob(job: Job<AnalysisJobData>): Promise<void> {
  const { projectId, ingestedFiles } = job.data;

  console.info(`[worker] Starting analysis for project ${projectId} (${ingestedFiles.length} files)`);

  // ── 1. Mark project as processing ───────────────────────────────────────────
  await db
    .update(projects)
    .set({ status: "processing", totalFiles: ingestedFiles.length })
    .where(eq(projects.id, projectId));

  // ── 2. Parse all files ────────────────────────────────────────────────────────
  const parsedMap = new Map<string, Awaited<ReturnType<typeof parseFile>>>();

  for (const file of ingestedFiles) {
    try {
      const parsed = await parseFile(file.contents, file.language, file.relativePath);
      parsedMap.set(file.relativePath, parsed);
    } catch (err) {
      console.warn(`[worker] Parse failed for ${file.relativePath}:`, err);
    }
  }

  // ── 3. Save file records to DB ────────────────────────────────────────────────
  const fileIdMap = new Map<string, string>(); // relativePath → db uuid

  for (const file of ingestedFiles) {
    const parsed = parsedMap.get(file.relativePath);
    const lineCount = file.contents.split("\n").length;

    const [inserted] = await db
      .insert(filesTable)
      .values({
        projectId,
        relativePath: file.relativePath,
        language: file.language,
        linesOfCode: lineCount,
        fileHash: file.fileHash,
        importCount: parsed?.imports.length ?? 0,
        exportCount: parsed?.exports.length ?? 0,
      })
      .returning({ id: filesTable.id });

    if (inserted) {
      fileIdMap.set(file.relativePath, inserted.id);
    }
  }

  // ── 4. Build graph and save edges ─────────────────────────────────────────────
  const { edges } = buildGraph(ingestedFiles, parsedMap);

  for (const edge of edges) {
    const sourceId = fileIdMap.get(edge.sourceRelativePath);
    const targetId = fileIdMap.get(edge.targetRelativePath);

    if (!sourceId || !targetId) continue;

    await db.insert(edgesTable).values({
      projectId,
      sourceFileId: sourceId,
      targetFileId: targetId,
      edgeType: edge.edgeType,
    });
  }

  // ── 5. AI analysis per file ────────────────────────────────────────────────────
  let processedFiles = 0;
  const totalFiles = ingestedFiles.length;

  for (const file of ingestedFiles) {
    const fileId = fileIdMap.get(file.relativePath);
    if (!fileId) continue;

    const parsed = parsedMap.get(file.relativePath);
    const importSources: string[] = parsed?.imports.map((imp: { source: string; isLocal: boolean }) => imp.source) ?? [];
    const exportNames: string[] = parsed?.exports ?? [];

    // Check cache — skip if analysed within last 24 hours for same hash
    const existingAnalysis = await db.query.analyses.findFirst({
      where: and(
        eq(analysesTable.fileId, fileId),
        eq(analysesTable.projectId, projectId)
      ),
    });

    if (existingAnalysis) {
      const ageMs = Date.now() - existingAnalysis.cachedAt.getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        // Cache hit — skip AI call
        processedFiles++;
        const progress = Math.round((processedFiles / totalFiles) * 100);
        await db.update(projects).set({ processedFiles }).where(eq(projects.id, projectId));
        await publishEvent(projectId, {
          type: "file_done",
          projectId,
          fileId,
          relativePath: file.relativePath,
          progress,
        });
        await job.updateProgress(progress);
        continue;
      }
    }

    // Call AI
    const explanation = await explainModule(file, importSources, exportNames);

    if (explanation) {
      await db.insert(analysesTable).values({
        fileId,
        projectId,
        summary: explanation.summary,
        workflow: explanation.workflow,
        imports: importSources,
        exports: exportNames,
      });
    }

    processedFiles++;
    const progress = Math.round((processedFiles / totalFiles) * 100);

    // Update DB progress counter
    await db
      .update(projects)
      .set({ processedFiles })
      .where(eq(projects.id, projectId));

    // Emit WebSocket progress event
    await publishEvent(projectId, {
      type: "file_done",
      projectId,
      fileId,
      relativePath: file.relativePath,
      progress,
    });

    await job.updateProgress(progress);
  }

  // ── 6. Mark project as done ───────────────────────────────────────────────────
  await db
    .update(projects)
    .set({ status: "done", processedFiles: totalFiles })
    .where(eq(projects.id, projectId));

  await publishEvent(projectId, {
    type: "analysis_complete",
    projectId,
    progress: 100,
  });

  console.info(`[worker] Analysis complete for project ${projectId}`);
}

// ─── Worker factory ────────────────────────────────────────────────────────────
export function startAnalysisWorker(): Worker<AnalysisJobData> {
  const worker = new Worker<AnalysisJobData>(
    ANALYSIS_QUEUE_NAME,
    processAnalysisJob,
    {
      connection: getRedis(),
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.info(`[worker] Job ${job.id} completed`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err);
    if (job?.data?.projectId) {
      await db
        .update(projects)
        .set({ status: "failed" })
        .where(eq(projects.id, job.data.projectId));

      await publishEvent(job.data.projectId, {
        type: "error",
        projectId: job.data.projectId,
        message: err.message,
      });
    }
  });

  return worker;
}
