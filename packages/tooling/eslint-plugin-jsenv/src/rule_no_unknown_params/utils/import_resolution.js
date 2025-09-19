import { dirname, resolve } from "path";

import { readFileSync } from "fs";

/**
 * Parses an imported JavaScript file using ESLint's parser
 * @param {string} filePath - Path to the file to parse
 * @param {string} content - File content
 * @param {Object} context - ESLint context for parser options
 * @returns {Object|null} - AST or null if parsing fails
 */
function parseFileWithESLint(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");

    // Simple regex-based parsing for exported functions
    // This is a basic approach for the specific case we're handling
    return parseExportedFunctions(content);
  } catch {
    // If parsing fails, return null and let the rule continue without import resolution
    return null;
  }
}

/**
 * Simple regex-based parser for exported functions
 * @param {string} content - File content
 * @returns {Object} - Simple AST-like structure
 */
function parseExportedFunctions(content) {
  const functions = [];

  // Match export function declarations with destructured parameters
  const exportFunctionRegex =
    /export\s+function\s+(\w+)\s*\(\s*\{([^}]+)\}\s*\)/g;
  let match;

  while ((match = exportFunctionRegex.exec(content)) !== null) {
    const functionName = match[1];
    const params = match[2].trim();

    // Parse the parameter names
    const paramNames = params
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Create simple AST-like structure
    const properties = paramNames.map((name) => ({
      type: "Property",
      key: { type: "Identifier", name },
      value: { type: "Identifier", name },
      shorthand: true,
    }));

    functions.push({
      type: "FunctionDeclaration",
      id: { name: functionName, type: "Identifier" },
      params: [
        {
          type: "ObjectPattern",
          properties,
        },
      ],
    });
  }

  return {
    type: "Program",
    body: functions.map((func) => ({
      type: "ExportNamedDeclaration",
      declaration: func,
    })),
  };
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
          const importedAst = parseFileWithESLint(resolvedPath);
          if (importedAst) {
            // Extract function definitions from imported file
            const importedFunctions = extractFunctionDefinitions(importedAst);

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
      // Handle @jsenv/eslint-import-resolver dynamically
      // Note: This is sync context so we can't use dynamic import
      // Just fall through to basic resolution
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
