import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Server } from "http";

import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import analysisRoutes from "./routes/analysis";
import { createWsServer, handleUpgrade } from "./routes/ws";
import { startAnalysisWorker } from "./workers/analysis.worker";

// ─── Hono app ──────────────────────────────────────────────────────────────────
const app = new Hono();

// ─── Global middleware ─────────────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization", "X-Project-Name"],
    allowMethods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    credentials: true,
  })
);

app.use("*", logger());
app.use("*", secureHeaders());

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.route("/api/auth", authRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/analysis", analysisRoutes);

// ─── 404 / error handlers ──────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("[server] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 8080);

const httpServer = serve(
  {
    fetch: app.fetch,
    port: PORT,
    createServer: undefined, // use default http.createServer
  },
  (info) => {
    console.info(`✅ Agent Arch server running on http://localhost:${info.port}`);
    console.info(`📡 WebSocket endpoint: ws://localhost:${info.port}/ws/:projectId`);
    console.info(`🏥 Health check: http://localhost:${info.port}/health`);
    console.info(`🔐 Auth: http://localhost:${info.port}/api/auth`);
  }
) as Server;

// ─── WebSocket upgrade ─────────────────────────────────────────────────────────
const wss = createWsServer();

httpServer.on("upgrade", (req, socket, head) => {
  handleUpgrade(wss, req, socket as import("net").Socket, head);
});

// ─── Analysis worker ──────────────────────────────────────────────────────────
startAnalysisWorker();
console.info("⚙️  Analysis worker started");

export type AppType = typeof app;
