import { readFileSync, statSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { debug } from "../debug.js";

// Top level functions used by the rest of the file to interact with cache
let parseFileWithCache;
let clearFileParseCache;
let getFileParseCacheSize;
let cleanupFileParseCache;
let scheduleMemoryCleanup;

cache: {
  /*
   * Cache Implementation Strategy:
   *
   * ESLint runs in two main scenarios that affect our caching strategy:
   *
   * 1. Background/Long-running processes: ESLint can run in the background (IDEs, watchers)
   *    and potentially grow "forever" as new files are linted. Memory can become very large,
   *    but we still want caching to speed up expensive parsing operations and maximize reuse
   *    as users update their files.
   *
   * 2. Bulk processing: ESLint can process large amounts of files with different configurations
   *    (context.cacheKey changes based on ESLint config). We want to maximize cache reuse
   *    per cacheKey because ESLint will likely process files in subgroups with the same config.
   *
   * Our approach:
   * - Organize cache by context keys (ESLint configurations) to maximize reuse within configs
   * - Limit files per context (1000) to prevent unbounded memory growth
   * - Use LRU eviction within each context to keep most recently accessed files
   * - Delayed cleanup (300ms) when switching contexts to allow context reuse while preventing
   *   memory leaks from abandoned contexts
   * - File modification time checking to ensure cache validity
   */

  const MAX_FILES_PER_CONTEXT = 1000;
  const CLEANUP_DELAY_MS = 300;

  // Map of contextKey -> Map of filePath -> cached data
  const contextCaches = new Map();
  const contextCleanupTimeouts = new Map();

  /**
   * Create cache key from file path and context (similar to eslint-plugin-import-x makeContextCacheKey)
   * @param {string} filePath - File path
   * @param {Object} context - ESLint context
   * @returns {Object} - Object with contextKey and filePath
   */
  function createCacheKey(filePath, context) {
    let contextKey;

    // If context already has a cacheKey (like eslint-plugin-import-x childContext), use it
    if (context.cacheKey) {
      contextKey = context.cacheKey;
    } else {
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

      contextKey = hash;
    }

    return { contextKey, filePath };
  }

  /**
   * Gets or creates a context cache
   * @param {string} contextKey - The context identifier
   * @returns {Map} - File cache for this context
   */
  function getContextCache(contextKey) {
    if (!contextCaches.has(contextKey)) {
      contextCaches.set(contextKey, new Map());
    }
    return contextCaches.get(contextKey);
  }

  /**
   * Implements LRU eviction when a context cache exceeds MAX_FILES_PER_CONTEXT
   * @param {Map} contextCache - The cache for a specific context
   */
  function evictLRUFromContext(contextCache) {
    while (contextCache.size >= MAX_FILES_PER_CONTEXT) {
      // Get the first (oldest) key and delete it
      const firstKey = contextCache.keys().next().value;
      if (firstKey) {
        contextCache.delete(firstKey);
      } else {
        break;
      }
    }
  }

  /**
   * Schedules cleanup of a context after a delay to allow context reuse
   * @param {string} contextKey - The context key to schedule cleanup for
   */
  function scheduleContextCleanup(contextKey) {
    if (contextCleanupTimeouts.has(contextKey)) {
      clearTimeout(contextCleanupTimeouts.get(contextKey));
    }

    const timeout = setTimeout(() => {
      const contextCache = contextCaches.get(contextKey);
      if (contextCache) {
        contextCache.clear();
        contextCaches.delete(contextKey);
      }
      contextCleanupTimeouts.delete(contextKey);
    }, CLEANUP_DELAY_MS);

    contextCleanupTimeouts.set(contextKey, timeout);
  }

  /**
   * Clear all caches and timeouts
   */
  function clearCache() {
    // Clear all cleanup timeouts first
    for (const timeout of contextCleanupTimeouts.values()) {
      clearTimeout(timeout);
    }
    contextCleanupTimeouts.clear();

    // Clear all context caches
    for (const contextCache of contextCaches.values()) {
      contextCache.clear();
    }
    contextCaches.clear();
  }

  /**
   * Get total cache size across all contexts
   * @returns {number} - Total number of cached entries
   */
  function getTotalSize() {
    let totalSize = 0;
    for (const contextCache of contextCaches.values()) {
      totalSize += contextCache.size;
    }
    return totalSize;
  }

  /**
   * Clean up stale cache entries (files that no longer exist or are very old)
   * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
   */
  function cleanupStaleEntries(maxAge = 5 * 60 * 1000) {
    const now = Date.now();

    for (const [contextKey, contextCache] of contextCaches.entries()) {
      const keysToDelete = [];

      for (const [filePath, cached] of contextCache.entries()) {
        try {
          const stats = statSync(filePath);
          // Remove if file is older than maxAge or mtime doesn't match
          if (
            now - stats.mtime.valueOf() > maxAge ||
            cached.mtime !== stats.mtime.valueOf()
          ) {
            keysToDelete.push(filePath);
          }
        } catch {
          // File doesn't exist anymore, remove from cache
          keysToDelete.push(filePath);
        }
      }

      for (const key of keysToDelete) {
        contextCache.delete(key);
      }

      // If context cache is empty, remove it and cancel cleanup timeout
      if (contextCache.size === 0) {
        contextCaches.delete(contextKey);
        const timeout = contextCleanupTimeouts.get(contextKey);
        if (timeout) {
          clearTimeout(timeout);
          contextCleanupTimeouts.delete(contextKey);
        }
      }
    }
  }

  /**
   * Force LRU eviction across all contexts if they exceed size limits
   */
  function forceEviction() {
    for (const contextCache of contextCaches.values()) {
      while (contextCache.size > MAX_FILES_PER_CONTEXT * 0.8) {
        // Keep 20% buffer
        const firstKey = contextCache.keys().next().value;
        if (!firstKey) break;
        contextCache.delete(firstKey);
      }
    }
  }
  // Initialize cache interface functions
  parseFileWithCache = function parseFileWithESLint(filePath, context) {
    try {
      const { contextKey, filePath: fileKey } = createCacheKey(
        filePath,
        context,
      );
      const contextCache = getContextCache(contextKey);

      // Check if we have a cached version
      if (contextCache.has(fileKey)) {
        const cached = contextCache.get(fileKey);

        // Check mtime to see if file has been modified
        try {
          const stats = statSync(filePath);
          if (cached.mtime === stats.mtime.valueOf()) {
            // Cache hit - move to end (LRU)
            const value = contextCache.get(fileKey);
            contextCache.delete(fileKey);
            contextCache.set(fileKey, value);
            return cached.ast;
          }
        } catch {
          // File might not exist anymore, remove from cache
          contextCache.delete(fileKey);
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

          // Evict LRU entries if cache is full
          if (contextCache.size >= MAX_FILES_PER_CONTEXT) {
            evictLRUFromContext(contextCache);
          }

          contextCache.set(fileKey, {
            ast,
            mtime: stats.mtime.valueOf(),
          });

          // Schedule cleanup for this context
          scheduleContextCleanup(contextKey);
        } catch {
          // If we can't stat the file, don't cache it
        }
      }

      return ast;
    } catch {
      // If parsing fails, return null and let the rule continue without import resolution
      return null;
    }
  };

  clearFileParseCache = function () {
    clearCache();
  };

  getFileParseCacheSize = function () {
    return getTotalSize();
  };

  cleanupFileParseCache = function (maxAge) {
    cleanupStaleEntries(maxAge);
  };

  scheduleMemoryCleanup = function () {
    cleanupStaleEntries();
    forceEviction();
  };
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
      debug(`Found import: ${importPath}`);

      const resolvedPath = resolveModulePath(
        importPath,
        filename,
        importResolver,
      );
      debug(`Resolved path for ${importPath}: ${resolvedPath || "null"}`);

      if (resolvedPath) {
        try {
          const importedAst = parseFileWithCache(resolvedPath, context);
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
      } else {
        // If we can't resolve the import (e.g., external packages like @jsenv/core),
        // create placeholder entries for imported functions so they are treated as external
        debug(`Creating external placeholders for ${importPath}`);
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" ||
            specifier.type === "ImportDefaultSpecifier"
          ) {
            const localName = specifier.local.name;
            debug(`Adding external function: ${localName} from ${importPath}`);
            // Mark as external function with no source code
            functionDefinitions.set(localName, {
              node: null, // No AST node available
              sourceFile: importPath, // Original import path for reference
              isExternal: true, // Mark as external
            });
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            const localName = specifier.local.name;
            debug(`Adding external namespace: ${localName} from ${importPath}`);
            // Create a namespace placeholder for external packages
            functionDefinitions.set(localName, {
              node: null,
              sourceFile: importPath,
              isNamespace: true,
              isExternal: true,
              functions: new Map(), // Empty functions map for external namespace
            });
          }
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
          const reExportedAst = parseFileWithCache(resolvedFromPath, context);
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

// Export the cache interface functions
export {
  cleanupFileParseCache,
  clearFileParseCache,
  getFileParseCacheSize,
  scheduleMemoryCleanup,
};
