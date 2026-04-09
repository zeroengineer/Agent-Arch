import crypto from "crypto";

/**
 * Compute SHA-256 hash of a string and return it as a hex string.
 */
export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}
