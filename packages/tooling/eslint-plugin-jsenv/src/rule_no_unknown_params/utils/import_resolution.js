import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileParseCache } from "./file_parse_cache.js";

/**
 * Parses an imported JavaScript file using ESLint's parser with caching
 * Based on eslint-plugin-import-x's export-map caching mechanism
 * @param {string} filePath - Path to the file to parse
 * @param {Object} context - ESLint context for parser options
 * @returns {Object|null} - AST or null if parsing fails
 */
function parseFileWithESLint(filePath, context) {
  try {
    // Check cache first
    const cachedAst = fileParseCache.get(filePath, context);
    if (cachedAst) {
      return cachedAst;
    }

    // Cache miss - read and parse file
    const content = readFileSync(filePath, "utf-8");
    const ast = parseContent(filePath, content, context);

    // Cache the result if parsing succeeded
    if (ast) {
      fileParseCache.set(filePath, context, ast);
    }

    return ast;
  } catch {
    // If parsing fails, return null and let the rule continue without import resolution
    return null;
  }
}

/**
 * Parses content using ESLint parser following eslint-plugin-import-x patterns
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {Object} context - ESLint context
 * @returns {Object|null} - AST or null if parsing fails
 */
function parseContent(filePath, content, context) {
  try {
    // Get parser from context (flat config vs legacy)
    const parser = getParser(context);
    if (!parser) {
      return null;
    }

    // Clone parser options to avoid frozen object issues
    let parserOptions = {
      ...(context.languageOptions?.parserOptions ||
        context.parserOptions ||
        {}),
    };

    // Add essential parsing options
    parserOptions.comment = true;
    parserOptions.attachComment = true; // backward compatibility
    parserOptions.tokens = true;
    parserOptions.loc = true;
    parserOptions.range = true;
    parserOptions.filePath = filePath;

    // Handle flat config ecmaVersion and sourceType
    parserOptions.ecmaVersion ??= context.languageOptions?.ecmaVersion || 2022;
    parserOptions.sourceType ??=
      context.languageOptions?.sourceType || "module";

    // Transform content like ESLint does
    const processedContent = transformContent(content);

    // Use parseForESLint if available, otherwise fall back to parse
    if (parser.parseForESLint && typeof parser.parseForESLint === "function") {
      const result = parser.parseForESLint(processedContent, parserOptions);
      return result.ast;
    } else if (parser.parse && typeof parser.parse === "function") {
      return parser.parse(processedContent, parserOptions);
    }

    return null;
  } catch {
    // If ESLint parsing fails completely, return null to skip this file
    return null;
  }
}

/**
 * Gets parser from context (handles both flat and legacy config)
 * @param {Object} context - ESLint context
 * @returns {Object|null} - Parser or null
 */
function getParser(context) {
  // Try flat config parser first
  if (context.languageOptions?.parser) {
    return context.languageOptions.parser;
  }

  // Try to get ESLint's default parser (espree) from the source code
  const sourceCode = context.getSourceCode();
  if (
    sourceCode &&
    sourceCode.parserServices &&
    sourceCode.parserServices.parseForESLint
  ) {
    return {
      parseForESLint: sourceCode.parserServices.parseForESLint,
    };
  }

  // Try to get the default parser that ESLint uses (espree)
  try {
    const require = createRequire(import.meta.url);
    const espree = require("espree");
    return espree;
  } catch {
    // Fall back to simple parsing if no parser available
    return null;
  }
}

/**
 * Transforms content like ESLint does (BOM strip and hashbang transform)
 * @param {string} content - File content
 * @returns {string} - Processed content
 */
function transformContent(content) {
  // Strip Unicode BOM
  let processed =
    content.codePointAt(0) === 0xfeff ? content.slice(1) : content;

  // Transform hashbang to comment
  processed = processed.replace(
    /^#!([^\r\n]+)/u,
    (_, captured) => `//${captured}`,
  );

  return processed;
}

/**
 * Resolves import statements to function definitions using ESLint's context
 * @param {Object} context - ESLint context
 * @param {Map} functionDefinitions - Local function definitions map
 */
export function resolveImports(context, functionDefinitions) {
  const sourceCode = context.getSourceCode();
  const filename = context.getFilename();
  const settings = context.settings;

  // Skip if no filename (like in tests without filename)
  if (!filename || filename === "<input>") {
    return;
  }

  const importResolver =
    settings["import-x/resolver"] || settings["import/resolver"];

  const ast = sourceCode.ast;

  // Find all import declarations
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      const importPath = node.source.value;
      const resolvedPath = resolveModulePath(
        importPath,
        filename,
        importResolver,
      );

      if (resolvedPath) {
        try {
          const importedAst = parseFileWithESLint(resolvedPath, context);
          if (importedAst) {
            // Extract function definitions from imported file
            const importedFunctions = extractFunctionDefinitions(importedAst);

            // Handle re-exports by resolving them recursively
            const reExportedFunctions = resolveReExports(
              importedAst,
              resolvedPath,
              context,
            );

            // Merge re-exported functions with directly defined functions
            for (const [name, func] of reExportedFunctions) {
              importedFunctions.set(name, func);
            }

            // Map imported names to local names
            for (const specifier of node.specifiers) {
              if (specifier.type === "ImportSpecifier") {
                const importedName = specifier.imported.name;
                const localName = specifier.local.name;

                if (importedFunctions.has(importedName)) {
                  functionDefinitions.set(
                    localName,
                    importedFunctions.get(importedName),
                  );
                }
              }
            }
          }
        } catch {
          // Silently skip files that can't be resolved/parsed
          // This matches real-world ESLint behavior where not all files are analyzable
        }
      }
    }
  }
}

/**
 * Resolves a module path relative to the importing file
 * @param {string} importPath - The import path (e.g., './helper.js')
 * @param {string} currentFile - The current file path
 * @param {Object} importResolver - ESLint import resolver settings
 * @returns {string|null} - Resolved absolute path or null
 */
function resolveModulePath(importPath, currentFile, importResolver) {
  // Try using ESLint import resolver if available
  if (importResolver && importResolver["@jsenv/eslint-import-resolver"]) {
    try {
      // Use createRequire to load @jsenv/eslint-import-resolver
      const require = createRequire(import.meta.url);
      const resolver = require("@jsenv/eslint-import-resolver");
      const options = importResolver["@jsenv/eslint-import-resolver"];

      // Use the resolver's resolve interface
      const result = resolver.resolve(importPath, currentFile, options);

      if (result && result.found && result.path) {
        return result.path;
      }
    } catch {
      // Fall back to default resolution if resolver fails
    }
  }

  // Fallback: Only handle relative imports
  if (!importPath.startsWith("./") && !importPath.startsWith("../")) {
    return null;
  }

  try {
    const currentDir = dirname(currentFile);
    return resolve(currentDir, importPath);
  } catch {
    return null;
  }
}

/**
 * Extracts function definitions from an AST
 * @param {Object} ast - The AST to analyze
 * @returns {Map} - Map of function name to function definition
 */
function extractFunctionDefinitions(ast) {
  const functions = new Map();

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    // Handle function declarations
    if (node.type === "FunctionDeclaration" && node.id?.name) {
      functions.set(node.id.name, node);
    }

    // Handle exported function expressions
    if (node.type === "ExportNamedDeclaration") {
      if (
        node.declaration?.type === "FunctionDeclaration" &&
        node.declaration.id?.name
      ) {
        functions.set(node.declaration.id.name, node.declaration);
      } else if (node.declaration?.type === "VariableDeclaration") {
        for (const declarator of node.declaration.declarations) {
          if (
            declarator.id?.name &&
            (declarator.init?.type === "FunctionExpression" ||
              declarator.init?.type === "ArrowFunctionExpression")
          ) {
            functions.set(declarator.id.name, declarator.init);
          }
        }
      }
    }

    // Handle variable declarations with function expressions
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations) {
        if (
          declarator.id?.name &&
          (declarator.init?.type === "FunctionExpression" ||
            declarator.init?.type === "ArrowFunctionExpression")
        ) {
          functions.set(declarator.id.name, declarator.init);
        }
      }
    }

    // Traverse child nodes
    for (const key in node) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          traverse(item);
        }
      } else {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return functions;
}

/**
 * Resolves re-exports recursively to find function definitions
 * @param {Object} ast - AST of the file containing re-exports
 * @param {string} currentFilePath - Path to the current file
 * @param {Object} context - ESLint context
 * @returns {Map} - Map of re-exported function names to definitions
 */
function resolveReExports(ast, currentFilePath, context) {
  const reExportedFunctions = new Map();

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    // Handle re-export declarations: export { name } from "./file.js"
    if (
      node.type === "ExportNamedDeclaration" &&
      node.source &&
      node.specifiers
    ) {
      const fromPath = node.source.value;
      const resolvedFromPath = resolveModulePath(
        fromPath,
        currentFilePath,
        null, // No resolver needed for relative paths
      );

      if (resolvedFromPath) {
        try {
          const reExportedAst = parseFileWithESLint(resolvedFromPath, context);
          if (reExportedAst) {
            const reExportedFileFunctions =
              extractFunctionDefinitions(reExportedAst);

            for (const specifier of node.specifiers) {
              if (specifier.type === "ExportSpecifier") {
                const exportedName = specifier.exported.name;
                const localName = specifier.local.name;

                if (reExportedFileFunctions.has(localName)) {
                  reExportedFunctions.set(
                    exportedName,
                    reExportedFileFunctions.get(localName),
                  );
                }
              }
            }
          }
        } catch {
          // Silently skip files that can't be resolved
        }
      }
    }

    // Traverse child nodes
    for (const key in node) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          traverse(item);
        }
      } else {
        traverse(child);
      }
    }
  }

  traverse(ast);
  return reExportedFunctions;
}
