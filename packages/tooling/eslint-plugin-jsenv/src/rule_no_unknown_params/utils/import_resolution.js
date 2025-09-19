import { readFileSync, statSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";

// Simple file parsing cache similar to eslint-plugin-import-x
const fileParseCache = new Map();

/**
 * Create cache key from file path and context (similar to eslint-plugin-import-x makeContextCacheKey)
 * @param {string} filePath - File path
 * @param {Object} context - ESLint context
 * @returns {string} - Cache key
 */
function createCacheKey(filePath, context) {
  // If context already has a cacheKey (like eslint-plugin-import-x childContext), use it
  if (context.cacheKey) {
    return `${context.cacheKey}\0${filePath}`;
  }

  // Build cache key similar to eslint-plugin-import-x makeContextCacheKey
  const { settings, parserOptions, languageOptions, cwd } = context;
  const parserOpts = languageOptions?.parserOptions || parserOptions || {};

  let hash = cwd || "";
  hash = `${hash}\0${JSON.stringify(settings || {})}`;
  hash = `${hash}\0${JSON.stringify(parserOpts)}`;

  if (languageOptions) {
    hash = `${hash}\0${String(languageOptions.ecmaVersion)}`;
    hash = `${hash}\0${String(languageOptions.sourceType)}`;
    hash = `${hash}\0${JSON.stringify(languageOptions.parser || "espree")}`;
  }

  return `${hash}\0${filePath}`;
}

/**
 * Parses an imported JavaScript file using ESLint's parser with caching
 * Based on eslint-plugin-import-x's export-map caching mechanism
 * @param {string} filePath - Path to the file to parse
 * @param {Object} context - ESLint context for parser options
 * @returns {Object|null} - AST or null if parsing fails
 */
function parseFileWithESLint(filePath, context) {
  try {
    const cacheKey = createCacheKey(filePath, context);

    // Check if we have a cached version
    if (fileParseCache.has(cacheKey)) {
      const cached = fileParseCache.get(cacheKey);

      // Check mtime to see if file has been modified
      try {
        const stats = statSync(filePath);
        if (cached.mtime === stats.mtime.valueOf()) {
          return cached.ast;
        }
      } catch {
        // File might not exist anymore, remove from cache
        fileParseCache.delete(cacheKey);
        return null;
      }
    }

    // Cache miss or file modified - read and parse file
    const content = readFileSync(filePath, "utf-8");
    const ast = parseContent(filePath, content, context);

    // Cache the result if parsing succeeded
    if (ast) {
      try {
        const stats = statSync(filePath);
        fileParseCache.set(cacheKey, {
          ast,
          mtime: stats.mtime.valueOf(),
        });
      } catch {
        // If we can't stat the file, don't cache it
      }
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
 * @param {number} maxDepth - Maximum depth for import resolution (default: 12)
 */
export function resolveImports(context, functionDefinitions, maxDepth = 12) {
  // Initialize cycle detection set
  const visitedFiles = new Set();

  return resolveImportsWithCycleDetection(
    context,
    functionDefinitions,
    visitedFiles,
    0, // current depth
    maxDepth,
  );
}

/**
 * Internal function that handles import resolution with cycle detection
 * @param {Object} context - ESLint context
 * @param {Map} functionDefinitions - Map to store function definitions
 * @param {Set} visitedFiles - Set of files currently being processed (for cycle detection)
 * @param {number} currentDepth - Current recursion depth
 * @param {number} maxDepth - Maximum allowed recursion depth
 */
function resolveImportsWithCycleDetection(
  context,
  functionDefinitions,
  visitedFiles,
  currentDepth,
  maxDepth,
) {
  const sourceCode = context.getSourceCode();
  const filename = context.getFilename();
  const settings = context.settings;

  // Skip if no filename (like in tests without filename)
  if (!filename || filename === "<input>") {
    return;
  }

  // Check depth limit to prevent memory issues
  if (currentDepth >= maxDepth) {
    return;
  }

  // Add current file to visited set for cycle detection
  if (visitedFiles.has(filename)) {
    // Cycle detected, stop processing to avoid infinite loop
    return;
  }
  visitedFiles.add(filename);

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
            const importedFunctions = extractFunctionDefinitions(
              importedAst,
              resolvedPath,
            );

            // Handle re-exports only if not in a cycle to prevent infinite recursion
            if (!visitedFiles.has(resolvedPath)) {
              const reExportedFunctions = resolveReExportsWithCycleDetection(
                importedAst,
                resolvedPath,
                context,
                visitedFiles,
                currentDepth + 1,
                maxDepth,
              );

              // Merge re-exported functions with directly defined functions
              for (const [name, func] of reExportedFunctions) {
                // Add source file metadata to re-exported function
                const functionWithSource = {
                  ...func,
                  __sourceFile: resolvedPath,
                };
                importedFunctions.set(name, functionWithSource);
              }
            }

            // Map imported names to local names
            for (const specifier of node.specifiers) {
              if (specifier.type === "ImportSpecifier") {
                const importedName = specifier.imported.name;
                const localName = specifier.local.name;

                if (importedFunctions.has(importedName)) {
                  const functionNode = importedFunctions.get(importedName);
                  // Add source file metadata to function definition
                  const functionWithSource = {
                    ...functionNode,
                    __sourceFile: resolvedPath,
                  };
                  functionDefinitions.set(localName, functionWithSource);
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

  // Remove current file from visited set when done processing
  visitedFiles.delete(filename);
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
 * @param {string} sourceFile - The file path where these functions are defined
 * @returns {Map} - Map of function name to function definition
 */
function extractFunctionDefinitions(ast, sourceFile = null) {
  const functions = new Map();

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    // Handle function declarations
    if (node.type === "FunctionDeclaration" && node.id?.name) {
      functions.set(node.id.name, {
        node,
        sourceFile: sourceFile || null,
      });
    }

    // Handle exported function expressions
    if (node.type === "ExportNamedDeclaration") {
      if (
        node.declaration?.type === "FunctionDeclaration" &&
        node.declaration.id?.name
      ) {
        functions.set(node.declaration.id.name, {
          node: node.declaration,
          sourceFile: sourceFile || null,
        });
      } else if (node.declaration?.type === "VariableDeclaration") {
        for (const declarator of node.declaration.declarations) {
          if (
            declarator.id?.name &&
            (declarator.init?.type === "FunctionExpression" ||
              declarator.init?.type === "ArrowFunctionExpression")
          ) {
            functions.set(declarator.id.name, {
              node: declarator.init,
              sourceFile: sourceFile || null,
            });
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
          functions.set(declarator.id.name, {
            node: declarator.init,
            sourceFile: sourceFile || null,
          });
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
 * Resolves re-exports recursively to find function definitions with cycle detection
 * @param {Object} ast - AST of the file containing re-exports
 * @param {string} currentFilePath - Path to the current file
 * @param {Object} context - ESLint context
 * @param {Set} visitedFiles - Set of files currently being processed (for cycle detection)
 * @param {number} currentDepth - Current recursion depth
 * @param {number} maxDepth - Maximum allowed recursion depth
 * @returns {Map} - Map of re-exported function names to definitions
 */
function resolveReExportsWithCycleDetection(
  ast,
  currentFilePath,
  context,
  visitedFiles,
  currentDepth,
  maxDepth,
) {
  // Check depth limit to prevent memory issues
  if (currentDepth >= maxDepth) {
    return new Map();
  }

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
        // Check for cycle before processing
        if (visitedFiles.has(resolvedFromPath)) {
          // Cycle detected, skip this re-export to avoid infinite loop
          return;
        }

        try {
          const reExportedAst = parseFileWithESLint(resolvedFromPath, context);
          if (reExportedAst) {
            const reExportedFileFunctions = extractFunctionDefinitions(
              reExportedAst,
              resolvedFromPath,
            );

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

/**
 * Clear the file parse cache
 */
export function clearFileParseCache() {
  fileParseCache.clear();
}

/**
 * Get cache size for debugging/monitoring
 * @returns {number} - Number of cached entries
 */
export function getFileParseCacheSize() {
  return fileParseCache.size;
}

/**
 * Clean up stale cache entries (files that no longer exist or are very old)
 * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
 */
export function cleanupFileParseCache(maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  const keysToDelete = [];

  for (const [cacheKey, cached] of fileParseCache.entries()) {
    // Extract file path from cache key (before the first \0)
    const filePath = cacheKey.split("\0")[0];

    try {
      const stats = statSync(filePath);
      // Remove if file is older than maxAge or mtime doesn't match
      if (
        now - stats.mtime.valueOf() > maxAge ||
        cached.mtime !== stats.mtime.valueOf()
      ) {
        keysToDelete.push(cacheKey);
      }
    } catch {
      // File doesn't exist anymore, remove from cache
      keysToDelete.push(cacheKey);
    }
  }

  for (const key of keysToDelete) {
    fileParseCache.delete(key);
  }
}
