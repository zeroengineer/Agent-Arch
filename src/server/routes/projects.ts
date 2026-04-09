import { Hono } from "hono";
import { sessionMiddleware, type AuthVariables } from "../middleware/auth";
import { ingestInput } from "../lib/ingest";
import { db } from "../db/index";
import {
  projects,
  files as filesTable,
  edges as edgesTable,
  analyses as analysesTable,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getAnalysisQueue } from "../workers/analysis.worker";

const projectRoutes = new Hono<{ Variables: AuthVariables }>();

// Apply auth middleware to all project routes
projectRoutes.use("/*", sessionMiddleware);

// ─── POST /api/projects ────────────────────────────────────────────────────────
/**
 * Accept any of the 6 input modes, normalise via ingestInput(),
 * create a project record, and enqueue the analysis job.
 *
 * Returns: { projectId, jobId, detectedMode, fileCount }
 */
projectRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let ingestResult: Awaited<ReturnType<typeof ingestInput>>;
  try {
    ingestResult = await ingestInput(c.req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process input";
    return c.json({ error: message }, 400);
  }

  const { files: ingestedFiles, mode } = ingestResult;

  if (ingestedFiles.length === 0) {
    return c.json({ error: "No supported source files found in input" }, 400);
  }

  // Derive a project name from the first file or the request header
  const firstFile = ingestedFiles.find(() => true);
  const [firstSegment = "project"] = firstFile?.relativePath.split("/") ?? ["project"];
  const projectName: string =
    (c.req.header("x-project-name") as string | undefined) ?? firstSegment;

  // Create project record
  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: projectName,
      inputMode: mode,
      status: "pending",
      totalFiles: ingestedFiles.length,
      processedFiles: 0,
    })
    .returning({ id: projects.id });

  if (!project) {
    return c.json({ error: "Failed to create project" }, 500);
  }

  // Enqueue analysis job
  const queue = getAnalysisQueue();
  const job = await queue.add(
    "analyze",
    {
      projectId: project.id,
      projectName,
      ingestedFiles,
    },
    { jobId: `project-${project.id}` }
  );

  return c.json(
    {
      projectId: project.id,
      jobId: job.id,
      detectedMode: mode,
      fileCount: ingestedFiles.length,
    },
    201
  );
});

// ─── GET /api/projects ────────────────────────────────────────────────────────
projectRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, userId),
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });

  return c.json({ projects: userProjects });
});

// ─── GET /api/projects/:id ─────────────────────────────────────────────────────
projectRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const projectFiles = await db.query.files.findMany({
    where: eq(filesTable.projectId, projectId),
  });

  const projectEdges = await db.query.edges.findMany({
    where: eq(edgesTable.projectId, projectId),
  });

  const projectAnalyses = await db.query.analyses.findMany({
    where: eq(analysesTable.projectId, projectId),
  });

  return c.json({
    project,
    files: projectFiles,
    edges: projectEdges,
    analyses: projectAnalyses,
  });
});

// ─── DELETE /api/projects/:id ──────────────────────────────────────────────────
projectRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Cascade deletes files, edges, analyses due to FK constraints
  await db.delete(projects).where(eq(projects.id, projectId));

  return c.json({ success: true });
});

// ─── POST /api/projects/:id/reanalyze ─────────────────────────────────────────
projectRoutes.post("/:id/reanalyze", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("id");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  if (project.status === "processing") {
    return c.json({ error: "Project is already being processed" }, 409);
  }

  // Fetch existing files to re-run analysis
  const existingFiles = await db.query.files.findMany({
    where: eq(filesTable.projectId, projectId),
  });

  if (existingFiles.length === 0) {
    return c.json({ error: "No files found for this project" }, 400);
  }

  // Delete old analyses and edges so they are regenerated
  await db.delete(analysesTable).where(eq(analysesTable.projectId, projectId));
  await db.delete(edgesTable).where(eq(edgesTable.projectId, projectId));
  await db.delete(filesTable).where(eq(filesTable.projectId, projectId));

  // Reset project status
  await db
    .update(projects)
    .set({ status: "pending", processedFiles: 0 })
    .where(eq(projects.id, projectId));

  return c.json({ error: "Re-analysis requires re-uploading files. Use POST /api/projects with the same input." }, 400);
});

export default projectRoutes;
