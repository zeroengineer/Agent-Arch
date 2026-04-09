import Redis from "ioredis";

// ─── Singleton connections ──────────────────────────────────────────────────────
let redisInstance: Redis | null = null;
let subscriberInstance: Redis | null = null;

function ensureRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set");
  return url;
}

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(ensureRedisUrl(), {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return redisInstance;
}

export function getSubscriber(): Redis {
  if (!subscriberInstance) {
    subscriberInstance = new Redis(ensureRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return subscriberInstance;
}

// ─── Pub/Sub channel helpers ───────────────────────────────────────────────────
export function projectChannel(projectId: string): string {
  return `project:${projectId}`;
}

export interface WsEvent {
  type: "file_done" | "analysis_complete" | "error";
  projectId: string;
  fileId?: string;
  relativePath?: string;
  progress?: number;
  message?: string;
}

export async function publishEvent(
  projectId: string,
  event: WsEvent
): Promise<void> {
  const redis = getRedis();
  await redis.publish(projectChannel(projectId), JSON.stringify(event));
}
