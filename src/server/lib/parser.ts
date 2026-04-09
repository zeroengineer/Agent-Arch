import { Parser, Language, type Node } from "web-tree-sitter";
import path from "path";
import fs from "fs";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ParsedImport {
  source: string;
  isLocal: boolean;
}

export interface ParsedFile {
  imports: ParsedImport[];
  exports: string[];
  functions: string[];
}

// ─── Parser singleton ──────────────────────────────────────────────────────────
let parserInitialized = false;
let treeSitterParser: Parser | null = null;

// Map language name → loaded Language object
const languageCache = new Map<string, Language>();

function getWasmPath(langName: string): string | null {
  const candidates = [
    path.join(process.cwd(), "node_modules", `tree-sitter-${langName}`, `tree-sitter-${langName}.wasm`),
    path.join(process.cwd(), "grammars", `tree-sitter-${langName}.wasm`),
    path.join(process.cwd(), `tree-sitter-${langName}.wasm`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function ensureInitialized(): Promise<Parser> {
  if (parserInitialized && treeSitterParser) return treeSitterParser;

  await Parser.init({
    locateFile(scriptName: string) {
      return path.join(process.cwd(), "node_modules", "web-tree-sitter", scriptName);
    },
  });

  treeSitterParser = new Parser();
  parserInitialized = true;
  return treeSitterParser;
}

async function getLanguageGrammar(languageName: string): Promise<Language | null> {
  if (languageCache.has(languageName)) {
    return languageCache.get(languageName)!;
  }

  const langNameMap: Record<string, string> = {
    javascript: "javascript",
    typescript: "typescript",
    python: "python",
    go: "go",
    rust: "rust",
    java: "java",
  };

  const tsName = langNameMap[languageName];
  if (!tsName) return null;

  const wasmPath = getWasmPath(tsName);
  if (!wasmPath) {
    console.debug(`[parser] WASM grammar not found for ${tsName}: ${languageName}`);
    return null;
  }

  try {
    const lang = await Language.load(wasmPath);
    languageCache.set(languageName, lang);
    return lang;
  } catch (err) {
    console.warn(`[parser] Could not load grammar for ${languageName}: ${err}`);
    return null;
  }
}

// ─── Regex-based fallback parser ───────────────────────────────────────────────
function parseWithRegex(contents: string, language: string): ParsedFile {
  const imports: ParsedImport[] = [];
  const exports: string[] = [];
  const functions: string[] = [];

  if (language === "javascript" || language === "typescript") {
    const importFromRe = /import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = importFromRe.exec(contents)) !== null) {
      const source = m[1]!;
      imports.push({ source, isLocal: source.startsWith("./") || source.startsWith("../") });
    }
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = requireRe.exec(contents)) !== null) {
      const source = m[1]!;
      imports.push({ source, isLocal: source.startsWith("./") || source.startsWith("../") });
    }
    const namedExportRe = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
    while ((m = namedExportRe.exec(contents)) !== null) {
      exports.push(m[1]!);
    }
    const reexportRe = /export\s+\{([^}]+)\}/g;
    while ((m = reexportRe.exec(contents)) !== null) {
      const names = m[1]!.split(",").map((s) => s.trim().split(/\s+as\s+/)[0]?.trim() ?? "");
      exports.push(...names.filter(Boolean));
    }
    const funcRe = /(?:function|async\s+function)\s+(\w+)/g;
    while ((m = funcRe.exec(contents)) !== null) {
      functions.push(m[1]!);
    }
    const arrowRe = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    while ((m = arrowRe.exec(contents)) !== null) {
      functions.push(m[1]!);
    }
  } else if (language === "python") {
    const importRe = /^(?:from\s+([\w.\/]+)\s+import|import\s+([\w.\/]+))/gm;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(contents)) !== null) {
      const source = (m[1] ?? m[2] ?? "").replace(/\./g, "/");
      imports.push({ source, isLocal: source.startsWith(".") });
    }
    const defRe = /^(?:def|class)\s+(\w+)/gm;
    while ((m = defRe.exec(contents)) !== null) {
      functions.push(m[1]!);
      if (!m[1]!.startsWith("_")) exports.push(m[1]!);
    }
  } else if (language === "go") {
    let m: RegExpExecArray | null;
    const importBlockRe = /import\s+\(([^)]+)\)/gs;
    while ((m = importBlockRe.exec(contents)) !== null) {
      const block = m[1]!;
      const lineRe = /["']([^"']+)["']/g;
      let lm: RegExpExecArray | null;
      while ((lm = lineRe.exec(block)) !== null) {
        const source = lm[1]!;
        imports.push({ source, isLocal: source.startsWith(".") });
      }
    }
    const singleImportRe = /import\s+["']([^"']+)["']/g;
    while ((m = singleImportRe.exec(contents)) !== null) {
      const source = m[1]!;
      imports.push({ source, isLocal: source.startsWith(".") });
    }
    const exportFuncRe = /^func\s+([A-Z]\w*)\s*\(/gm;
    while ((m = exportFuncRe.exec(contents)) !== null) {
      exports.push(m[1]!);
      functions.push(m[1]!);
    }
    const allFuncRe = /^func\s+(\w+)\s*\(/gm;
    while ((m = allFuncRe.exec(contents)) !== null) {
      if (!functions.includes(m[1]!)) functions.push(m[1]!);
    }
  } else if (language === "rust") {
    let m: RegExpExecArray | null;
    const useRe = /^use\s+([\w:]+)/gm;
    while ((m = useRe.exec(contents)) !== null) {
      const source = m[1]!.replace(/::/g, "/");
      imports.push({ source, isLocal: source.startsWith("crate/") || source.startsWith("self/") || source.startsWith("super/") });
    }
    const pubFnRe = /^pub\s+(?:async\s+)?fn\s+(\w+)/gm;
    while ((m = pubFnRe.exec(contents)) !== null) {
      exports.push(m[1]!);
      functions.push(m[1]!);
    }
    const fnRe = /^(?:async\s+)?fn\s+(\w+)/gm;
    while ((m = fnRe.exec(contents)) !== null) {
      if (!functions.includes(m[1]!)) functions.push(m[1]!);
    }
  } else if (language === "java") {
    let m: RegExpExecArray | null;
    const importRe = /^import\s+([\w.]+);/gm;
    while ((m = importRe.exec(contents)) !== null) {
      const source = m[1]!.replace(/\./g, "/");
      imports.push({ source, isLocal: false });
    }
    const publicRe = /public\s+(?:static\s+)?(?:\w+\s+)?(\w+)\s*\(/g;
    while ((m = publicRe.exec(contents)) !== null) {
      exports.push(m[1]!);
      functions.push(m[1]!);
    }
  } else if (language === "cpp" || language === "c") {
    let m: RegExpExecArray | null;
    const includeRe = /^#include\s+["<]([^">]+)[">]/gm;
    while ((m = includeRe.exec(contents)) !== null) {
      const source = m[1]!;
      imports.push({ source, isLocal: source.includes("/") && !source.startsWith("<") });
    }
    const funcRe = /^(?:[\w*]+\s+)+(\w+)\s*\([^)]*\)\s*\{/gm;
    while ((m = funcRe.exec(contents)) !== null) {
      if (!["if", "for", "while", "switch"].includes(m[1]!)) {
        functions.push(m[1]!);
      }
    }
  } else if (language === "csharp") {
    let m: RegExpExecArray | null;
    const usingRe = /^using\s+([\w.]+);/gm;
    while ((m = usingRe.exec(contents)) !== null) {
      imports.push({ source: m[1]!.replace(/\./g, "/"), isLocal: false });
    }
    const methodRe = /public\s+(?:static\s+)?(?:async\s+)?(?:\w+\s+)+(\w+)\s*\(/g;
    while ((m = methodRe.exec(contents)) !== null) {
      exports.push(m[1]!);
      functions.push(m[1]!);
    }
  }

  return {
    imports: deduplicateImports(imports),
    exports: [...new Set(exports)],
    functions: [...new Set(functions)],
  };
}

function deduplicateImports(imports: ParsedImport[]): ParsedImport[] {
  const seen = new Set<string>();
  return imports.filter((imp) => {
    if (seen.has(imp.source)) return false;
    seen.add(imp.source);
    return true;
  });
}

// ─── Tree-sitter based parsing ─────────────────────────────────────────────────
async function parseWithTreeSitter(
  contents: string,
  language: string
): Promise<ParsedFile | null> {
  try {
    const parser = await ensureInitialized();
    const lang = await getLanguageGrammar(language);
    if (!lang) return null;

    parser.setLanguage(lang);
    const tree = parser.parse(contents);
    if (!tree) return null;

    const imports: ParsedImport[] = [];
    const exports: string[] = [];
    const functions: string[] = [];

    function walk(node: Node): void {
      if (language === "javascript" || language === "typescript") {
        if (node.type === "import_declaration") {
          const sourceNode = node.childForFieldName("source");
          if (sourceNode) {
            const source = sourceNode.text.replace(/['"]/g, "");
            imports.push({
              source,
              isLocal: source.startsWith("./") || source.startsWith("../"),
            });
          }
        }
        if (node.type === "export_statement") {
          const nameNode =
            node.childForFieldName("name") ??
            node.namedChildren.find(
              (c) =>
                c.type === "identifier" ||
                c.type === "function_declaration" ||
                c.type === "class_declaration"
            );
          if (nameNode) {
            const nameText =
              nameNode.type === "identifier"
                ? nameNode.text
                : nameNode.childForFieldName("name")?.text ?? "";
            if (nameText) exports.push(nameText);
          }
        }
        if (
          node.type === "function_declaration" ||
          node.type === "function_expression" ||
          node.type === "arrow_function"
        ) {
          const nameNode = node.childForFieldName("name");
          if (nameNode) functions.push(nameNode.text);
        }
        if (node.type === "call_expression") {
          const funcNode = node.childForFieldName("function");
          if (funcNode?.text === "require") {
            const argsNode = node.childForFieldName("arguments");
            const firstArg = argsNode?.namedChildren[0];
            if (firstArg && firstArg.type === "string") {
              const source = firstArg.text.replace(/['"]/g, "");
              imports.push({
                source,
                isLocal: source.startsWith("./") || source.startsWith("../"),
              });
            }
          }
        }
      }
      for (const child of node.namedChildren) {
        walk(child);
      }
    }

    walk(tree.rootNode);

    return {
      imports: deduplicateImports(imports),
      exports: [...new Set(exports)],
      functions: [...new Set(functions)],
    };
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────
/**
 * Parse a source file and extract imports, exports, and function definitions.
 * Tries tree-sitter first; falls back to regex if grammar is unavailable.
 */
export async function parseFile(
  contents: string,
  language: string,
  relativePath: string
): Promise<ParsedFile> {
  const tsResult = await parseWithTreeSitter(contents, language);
  if (tsResult) return tsResult;

  console.info(`[parser] Using regex fallback for ${relativePath} (${language})`);
  return parseWithRegex(contents, language);
}
