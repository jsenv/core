import { readFileSync } from "fs";
import { dirname, resolve } from "path";

/**
 * Resolves import statements to function definitions using ESLint's context
 * @param {Object} context - ESLint context
 * @param {Map} functionDefinitions - Local function definitions map
 */
export function resolveImports(context, functionDefinitions) {
  const sourceCode = context.getSourceCode();
  const filename = context.getFilename();

  // Skip if no filename (like in tests without filename)
  if (!filename || filename === "<input>") {
    return;
  }

  const ast = sourceCode.ast;

  // Find all import declarations
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      const importPath = node.source.value;
      const resolvedPath = resolveModulePath(importPath, filename);

      if (resolvedPath) {
        try {
          const importedAst = parseImportedFile(resolvedPath);
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
 * @returns {string|null} - Resolved absolute path or null
 */
function resolveModulePath(importPath, currentFile) {
  // Only handle relative imports for now
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
 * Parses a JavaScript file and returns its AST using ESLint's parser
 * @param {string} filePath - Path to the file to parse
 * @param {Object} context - ESLint context to get parser options
 * @returns {Object|null} - AST or null if parsing fails
 */
function parseImportedFile(filePath) {
  try {
    const fileContent = readFileSync(filePath, "utf-8");

    // Create a basic parser using regex-based parsing for function definitions
    // This is a simplified approach that works without external dependencies
    return parseBasicFunctions(fileContent);
  } catch {
    return null;
  }
}

/**
 * Simple regex-based function parser for basic ES modules
 * This is a fallback when full AST parsing isn't available
 * @param {string} content - File content
 * @returns {Object} - Simple AST-like structure
 */
function parseBasicFunctions(content) {
  const functions = [];

  // Match export function declarations
  const exportFunctionRegex = /export\s+function\s+(\w+)\s*\(([^)]*)\)/g;
  let match;

  while ((match = exportFunctionRegex.exec(content)) !== null) {
    const functionName = match[1];
    const params = match[2];

    // Parse the parameter structure
    const parsedParams = parseParameterString(params);

    functions.push({
      type: "FunctionDeclaration",
      id: { name: functionName, type: "Identifier" },
      params: parsedParams,
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
 * Parses parameter string into AST-like parameter nodes
 * @param {string} paramStr - Parameter string like "{ id, name, ...rest }"
 * @returns {Array} - Array of parameter nodes
 */
function parseParameterString(paramStr) {
  if (!paramStr.trim().startsWith("{")) {
    // Simple identifier parameter
    return [{ type: "Identifier", name: paramStr.trim() }];
  }

  // Object destructuring parameter
  const properties = [];
  const objectContent = paramStr.slice(1, -1); // Remove { }

  // Simple parsing for properties
  const parts = objectContent.split(",").map((p) => p.trim());

  for (const part of parts) {
    if (part.startsWith("...")) {
      // Rest element
      properties.push({
        type: "RestElement",
        argument: { type: "Identifier", name: part.slice(3).trim() },
      });
    } else if (part) {
      // Regular property
      properties.push({
        type: "Property",
        key: { type: "Identifier", name: part },
        value: { type: "Identifier", name: part },
        shorthand: true,
      });
    }
  }

  return [
    {
      type: "ObjectPattern",
      properties,
    },
  ];
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
