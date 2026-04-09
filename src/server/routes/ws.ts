import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { getSubscriber, projectChannel, type WsEvent } from "../lib/redis";
import { db } from "../db/index";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";

// ─── Client registry ───────────────────────────────────────────────────────────
// projectId → Set of active WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

function addClient(projectId: string, ws: WebSocket): void {
  if (!clients.has(projectId)) clients.set(projectId, new Set());
  clients.get(projectId)!.add(ws);
}

function removeClient(projectId: string, ws: WebSocket): void {
  const set = clients.get(projectId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clients.delete(projectId);
}

function broadcast(projectId: string, event: WsEvent): void {
  const set = clients.get(projectId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// ─── Redis subscriber (single shared subscriber for all projects) ──────────────
let subscriberStarted = false;

async function startRedisSubscriber(): Promise<void> {
  if (subscriberStarted) return;
  subscriberStarted = true;

  const subscriber = getSubscriber();
  await subscriber.connect();

  subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
    // channel format: "project:<projectId>"
    const projectId = channel.replace("project:", "");
    try {
      const event = JSON.parse(message) as WsEvent;
      broadcast(projectId, event);
    } catch {
      // ignore malformed messages
    }
  });

  await subscriber.psubscribe("project:*");
}

// ─── WebSocket server factory ──────────────────────────────────────────────────
/**
 * Creates a WebSocketServer that piggybacks on the existing HTTP server.
 * Handles the upgrade for paths matching /ws/:projectId
 */
export function createWsServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Start Redis subscriber
  startRedisSubscriber().catch(console.error);

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // Extract projectId from URL path
    const url = req.url ?? "";
    const match = url.match(/^\/ws\/([^/?]+)/);
    const projectId = match?.[1];
    if (!projectId) {
      ws.close(1008, "Invalid URL");
      return;
    }

    // Verify project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      ws.send(JSON.stringify({ type: "error", message: "Project not found" }));
      ws.close(1008, "Project not found");
      return;
    }

    addClient(projectId, ws);

    // If already done, send the final event immediately
    if (project.status === "done") {
      ws.send(
        JSON.stringify({
          type: "analysis_complete",
          projectId,
          progress: 100,
        })
      );
    }

    // Handle incoming messages (ping/pong)
    ws.on("message", (data) => {
      const msg = data.toString();
      if (msg === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    });

    ws.on("close", () => {
      removeClient(projectId, ws);
    });

    ws.on("error", (err) => {
      console.error(`[ws] Error for project ${projectId}:`, err);
      removeClient(projectId, ws);
    });
  });

  return wss;
}

/**
 * Handle HTTP upgrade requests for WebSocket connections.
 * Call this from the HTTP server's 'upgrade' event.
 */
export function handleUpgrade(
  wss: WebSocketServer,
  req: IncomingMessage,
  socket: import("net").Socket,
  head: Buffer
): void {
  const url = req.url ?? "";
  if (url.startsWith("/ws/")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
}
