import type { HonoRequest } from "hono";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { sha256 } from "./hash";

// ─── Constants ─────────────────────────────────────────────────────────────────
export const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".cpp",
  ".c",
  ".cs",
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB
const MAX_TOTAL_FILES = 500;

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface IngestedFile {
  relativePath: string;
  absolutePath: string;
  contents: string;
  language: string;
  fileHash: string;
}

export type InputMode = "zip" | "files" | "folder_path" | "multi_folder";

export interface IngestResult {
  files: IngestedFile[];
  mode: InputMode;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".cs": "csharp",
  };
  return languageMap[ext] ?? "unknown";
}

function isSupported(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function makeIngestedFile(
  relativePath: string,
  absolutePath: string,
  contents: string
): IngestedFile {
  return {
    relativePath,
    absolutePath,
    contents,
    language: getLanguage(relativePath),
    fileHash: sha256(contents),
  };
}

function isBinary(buffer: Buffer): boolean {
  // Quick heuristic: if >30% of the first 512 bytes are null or non-printable, treat as binary
  const sample = buffer.slice(0, 512);
  let nonPrintable = 0;
  for (const byte of sample) {
    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      nonPrintable++;
    }
  }
  return sample.length > 0 && nonPrintable / sample.length > 0.3;
}

function normalizeAndLimit(
  fileList: IngestedFile[],
  skippedPaths: string[]
): IngestedFile[] {
  if (fileList.length > MAX_TOTAL_FILES) {
    console.warn(
      `[ingest] Project exceeds max file limit (${MAX_TOTAL_FILES}). Truncating.`
    );
    return fileList.slice(0, MAX_TOTAL_FILES);
  }
  if (skippedPaths.length > 0) {
    console.info(
      `[ingest] Skipped ${skippedPaths.length} file(s): ${skippedPaths.slice(0, 10).join(", ")}`
    );
  }
  return fileList;
}

// ─── ZIP ingestion ─────────────────────────────────────────────────────────────
function ingestZipBuffer(
  zipBuffer: Buffer,
  prefix: string = ""
): { files: IngestedFile[]; skipped: string[] } {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const resultFiles: IngestedFile[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName.replace(/\\/g, "/");
    if (!isSupported(entryName)) continue;

    const rawData = entry.getData();

    if (rawData.length > MAX_FILE_SIZE_BYTES) {
      skipped.push(entryName);
      console.warn(`[ingest] Skipped large file (${rawData.length} bytes): ${entryName}`);
      continue;
    }

    if (isBinary(rawData)) {
      skipped.push(entryName);
      continue;
    }

    let contents: string;
    try {
      contents = rawData.toString("utf8");
    } catch {
      skipped.push(entryName);
      continue;
    }

    const relativePath = prefix ? `${prefix}/${entryName}` : entryName;
    resultFiles.push(makeIngestedFile(relativePath, `zip://${relativePath}`, contents));
  }

  return { files: resultFiles, skipped };
}

// ─── Filesystem ingestion ──────────────────────────────────────────────────────
function walkDirectory(
  dirPath: string,
  prefix: string,
  resultFiles: IngestedFile[],
  skipped: string[]
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.warn(`[ingest] Cannot read directory ${dirPath}: ${err}`);
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = path.join(prefix, entry.name).replace(/\\/g, "/");

    // Skip hidden files and common non-source dirs
    if (
      entry.name.startsWith(".") ||
      entry.name === "node_modules" ||
      entry.name === "__pycache__" ||
      entry.name === "dist" ||
      entry.name === "build" ||
      entry.name === "target" ||
      entry.name === ".git"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      walkDirectory(absolutePath, relativePath, resultFiles, skipped);
    } else if (entry.isFile()) {
      if (!isSupported(entry.name)) continue;

      let stat: fs.Stats;
      try {
        stat = fs.statSync(absolutePath);
      } catch {
        skipped.push(relativePath);
        continue;
      }

      if (stat.size > MAX_FILE_SIZE_BYTES) {
        skipped.push(relativePath);
        console.warn(`[ingest] Skipped large file (${stat.size} bytes): ${relativePath}`);
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = fs.readFileSync(absolutePath);
      } catch {
        skipped.push(relativePath);
        continue;
      }

      if (isBinary(buffer)) {
        skipped.push(relativePath);
        continue;
      }

      let contents: string;
      try {
        contents = buffer.toString("utf8");
      } catch {
        skipped.push(relativePath);
        continue;
      }

      resultFiles.push(makeIngestedFile(relativePath, absolutePath, contents));
    }
  }
}

// ─── Main export ───────────────────────────────────────────────────────────────
/**
 * Reads the Hono request and normalises all input modes into a flat list of IngestedFile.
 *
 * Detection order:
 * 1. multipart/form-data
 *    a. field "folder" (.zip) → zip mode
 *    b. field "file" (single file) → single file mode
 *    c. fields "files[]" → multiple files mode
 * 2. application/json
 *    a. { folderPath: string } → single folder path mode
 *    b. { folderPaths: string[] } → multiple folder paths mode
 */
export async function ingestInput(req: HonoRequest): Promise<IngestResult> {
  const contentType = req.header("content-type") ?? "";

  // ── multipart/form-data ──────────────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new Error("Failed to parse multipart form data");
    }

    // a. ZIP folder upload
    const folderField = formData.get("folder");
    if (folderField && folderField instanceof File) {
      if (!folderField.name.endsWith(".zip")) {
        throw new Error('Field "folder" must be a .zip file');
      }
      const zipBuffer = Buffer.from(await folderField.arrayBuffer());
      const { files: resultFiles, skipped } = ingestZipBuffer(zipBuffer);
      if (resultFiles.length === 0) {
        throw new Error("ZIP archive contains no supported source files");
      }
      return { files: normalizeAndLimit(resultFiles, skipped), mode: "zip" };
    }

    // b. Single file upload
    const singleField = formData.get("file");
    if (singleField && singleField instanceof File) {
      if (!isSupported(singleField.name)) {
        throw new Error(
          `Unsupported file extension: ${path.extname(singleField.name)}`
        );
      }
      const buffer = Buffer.from(await singleField.arrayBuffer());
      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024}KB`
        );
      }
      if (isBinary(buffer)) {
        throw new Error("Uploaded file appears to be binary");
      }
      const contents = buffer.toString("utf8");
      return {
        files: [makeIngestedFile(singleField.name, `upload://${singleField.name}`, contents)],
        mode: "files",
      };
    }

    // c. Multiple files
    const multipleFiles = formData.getAll("files[]");
    if (multipleFiles.length > 0) {
      const resultFiles: IngestedFile[] = [];
      const skipped: string[] = [];

      for (const field of multipleFiles) {
        if (!(field instanceof File)) continue;
        if (!isSupported(field.name)) {
          skipped.push(field.name);
          continue;
        }
        const buffer = Buffer.from(await field.arrayBuffer());
        if (buffer.length > MAX_FILE_SIZE_BYTES) {
          skipped.push(field.name);
          console.warn(`[ingest] Skipped large file: ${field.name}`);
          continue;
        }
        if (isBinary(buffer)) {
          skipped.push(field.name);
          continue;
        }
        let contents: string;
        try {
          contents = buffer.toString("utf8");
        } catch {
          skipped.push(field.name);
          continue;
        }
        resultFiles.push(makeIngestedFile(field.name, `upload://${field.name}`, contents));
      }

      if (resultFiles.length === 0) {
        throw new Error("No supported source files in upload");
      }

      return { files: normalizeAndLimit(resultFiles, skipped), mode: "files" };
    }

    throw new Error(
      'multipart/form-data request must have a "folder" (.zip), "file", or "files[]" field'
    );
  }

  // ── application/json ─────────────────────────────────────────────────────────
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new Error("Failed to parse JSON body");
    }

    if (
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body)
    ) {
      const bodyObj = body as Record<string, unknown>;

      // a. Single folder path
      if (typeof bodyObj.folderPath === "string") {
        const folderPath = path.resolve(bodyObj.folderPath);
        if (!fs.existsSync(folderPath)) {
          throw new Error(`Folder path does not exist: ${folderPath}`);
        }
        if (!fs.statSync(folderPath).isDirectory()) {
          throw new Error(`Path is not a directory: ${folderPath}`);
        }
        const resultFiles: IngestedFile[] = [];
        const skipped: string[] = [];
        walkDirectory(folderPath, path.basename(folderPath), resultFiles, skipped);
        if (resultFiles.length === 0) {
          throw new Error("Folder contains no supported source files");
        }
        return { files: normalizeAndLimit(resultFiles, skipped), mode: "folder_path" };
      }

      // b. Multiple folder paths
      if (
        Array.isArray(bodyObj.folderPaths) &&
        bodyObj.folderPaths.every((p) => typeof p === "string")
      ) {
        const folderPaths = bodyObj.folderPaths as string[];
        const resultFiles: IngestedFile[] = [];
        const skipped: string[] = [];

        for (const rawPath of folderPaths) {
          const folderPath = path.resolve(rawPath);
          if (!fs.existsSync(folderPath)) {
            console.warn(`[ingest] Folder path does not exist, skipping: ${folderPath}`);
            continue;
          }
          if (!fs.statSync(folderPath).isDirectory()) {
            console.warn(`[ingest] Path is not a directory, skipping: ${folderPath}`);
            continue;
          }
          walkDirectory(folderPath, path.basename(folderPath), resultFiles, skipped);
        }

        if (resultFiles.length === 0) {
          throw new Error("No supported source files found across provided folder paths");
        }

        return { files: normalizeAndLimit(resultFiles, skipped), mode: "multi_folder" };
      }
    }

    throw new Error(
      'JSON body must contain "folderPath" (string) or "folderPaths" (string[])'
    );
  }

  throw new Error(
    "Unsupported Content-Type. Use multipart/form-data or application/json"
  );
}
