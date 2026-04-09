import { Hono } from "hono";
import { sessionMiddleware, type AuthVariables } from "../middleware/auth";
import { db } from "../db/index";
import {
  projects,
  analyses as analysesTable,
  files as filesTable,
} from "../db/schema";
import { eq, and } from "drizzle-orm";

const analysisRoutes = new Hono<{ Variables: AuthVariables }>();

// Apply auth to all analysis routes
analysisRoutes.use("/*", sessionMiddleware);

// ─── GET /api/analysis/:projectId/status ──────────────────────────────────────
/**
 * Returns real-time analysis progress for a project.
 * { status, progress: 0-100, processedFiles, totalFiles, currentFile }
 */
analysisRoutes.get("/:projectId/status", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const progress =
    project.totalFiles > 0
      ? Math.round((project.processedFiles / project.totalFiles) * 100)
      : 0;

  // Find the most recently analysed file to report as "currentFile"
  let currentFile: string | null = null;
  if (project.status === "processing" && project.processedFiles > 0) {
    // Query analyses for this project ordered by cachedAt desc
    const latestAnalysis = await db.query.analyses.findFirst({
      where: eq(analysesTable.projectId, projectId),
      orderBy: (analyses, { desc }) => [desc(analyses.cachedAt)],
    });
    if (latestAnalysis) {
      const fileRecord = await db.query.files.findFirst({
        where: eq(filesTable.id, latestAnalysis.fileId),
      });
      currentFile = fileRecord?.relativePath ?? null;
    }
  }

  return c.json({
    status: project.status,
    progress,
    processedFiles: project.processedFiles,
    totalFiles: project.totalFiles,
    currentFile,
  });
});

export default analysisRoutes;
