import DirectedGraph from "graphology";
import { degreeCentrality } from "graphology-metrics/centrality/degree";
import path from "path";
import type { IngestedFile } from "../../server/lib/ingest";
import type { ParsedFile } from "../../server/lib/parser";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface GraphNode {
  relativePath: string;
  language: string;
  lineCount: number;
  importCount: number;
  exportCount: number;
  centrality: number;
}

export interface GraphEdge {
  sourceRelativePath: string;
  targetRelativePath: string;
  edgeType: "import" | "call" | "reexport";
}

export interface BuiltGraph {
  graph: DirectedGraph;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

// ─── Path resolution helpers ───────────────────────────────────────────────────
/**
 * Given a source file's relative path and an import specifier,
 * try to resolve which file in the project it points to.
 */
function resolveLocalImport(
  sourceRelativePath: string,
  importSource: string,
  fileMap: Map<string, IngestedFile>
): string | null {
  const sourceDir = path.dirname(sourceRelativePath);
  const resolved = path.normalize(path.join(sourceDir, importSource)).replace(/\\/g, "/");

  // Try exact match first
  if (fileMap.has(resolved)) return resolved;

  // Try with common extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fileMap.has(candidate)) return candidate;
  }

  // Try index files
  for (const ext of extensions) {
    const candidate = `${resolved}/index${ext}`;
    if (fileMap.has(candidate)) return candidate;
  }

  return null;
}

// ─── Main graph builder ────────────────────────────────────────────────────────
/**
 * Build a directed graphology graph from the parsed file data.
 * Each file becomes a node; local imports become directed edges.
 * Computes degree centrality for each node.
 */
export function buildGraph(
  files: IngestedFile[],
  parsedMap: Map<string, ParsedFile>
): BuiltGraph {
  const graph = new DirectedGraph();
  const fileMap = new Map<string, IngestedFile>(
    files.map((f) => [f.relativePath, f])
  );
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // ── Add all nodes ────────────────────────────────────────────────────────────
  for (const file of files) {
    const parsed = parsedMap.get(file.relativePath);
    const lineCount = file.contents.split("\n").length;
    const importCount = parsed?.imports.length ?? 0;
    const exportCount = parsed?.exports.length ?? 0;

    const node: GraphNode = {
      relativePath: file.relativePath,
      language: file.language,
      lineCount,
      importCount,
      exportCount,
      centrality: 0, // filled after all nodes are in
    };

    nodes.set(file.relativePath, node);

    if (!graph.hasNode(file.relativePath)) {
      graph.addNode(file.relativePath, {
        relativePath: file.relativePath,
        language: file.language,
        lineCount,
        importCount,
        exportCount,
      });
    }
  }

  // ── Resolve and add edges ────────────────────────────────────────────────────
  for (const file of files) {
    const parsed = parsedMap.get(file.relativePath);
    if (!parsed) continue;

    for (const imp of parsed.imports) {
      if (!imp.isLocal) continue; // skip external package imports

      const targetPath = resolveLocalImport(file.relativePath, imp.source, fileMap);
      if (!targetPath) continue;
      if (targetPath === file.relativePath) continue; // no self-loops

      // Determine edge type: if the imported module re-exports, mark as reexport
      const targetParsed = parsedMap.get(targetPath);
      const edgeType: "import" | "reexport" =
        targetParsed && targetParsed.exports.length > 0 ? "import" : "import";

      const edgeKey = `${file.relativePath}→${targetPath}`;
      if (!graph.hasEdge(edgeKey)) {
        graph.addDirectedEdgeWithKey(edgeKey, file.relativePath, targetPath, {
          edgeType,
        });
        edges.push({
          sourceRelativePath: file.relativePath,
          targetRelativePath: targetPath,
          edgeType,
        });
      }
    }
  }

  // ── Compute centrality ───────────────────────────────────────────────────────
  let centralityMap: Record<string, number> = {};
  try {
    centralityMap = degreeCentrality(graph) as Record<string, number>;
  } catch {
    // If graph has < 2 nodes, centrality might fail — default to 0
    centralityMap = {};
  }

  for (const [relativePath, node] of nodes) {
    node.centrality = centralityMap[relativePath] ?? 0;
    graph.setNodeAttribute(relativePath, "centrality", node.centrality);
  }

  return { graph, nodes, edges };
}
