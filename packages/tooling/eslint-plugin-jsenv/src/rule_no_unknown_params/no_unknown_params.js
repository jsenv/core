import { debug } from "./debug.js";
import { analyzeCallExpression, analyzeJSXElement } from "./utils/analysis.js";
import {
  resolveImports,
  scheduleMemoryCleanup,
} from "./utils/import_resolution.js";
import {
  resolveWrapperFunction,
  resolveWrapperReferences,
} from "./utils/wrapper_resolution.js";

export const noUnknownParamsRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing unknown params not recognized in function definition or call chain",
      category: "Possible Errors",
      recommended: false,
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          maxImportDepth: {
            type: "integer",
            minimum: 1,
            default: 12,
            description:
              "Maximum depth for resolving imports to prevent infinite loops",
          },
          maxChainDepth: {
            type: "integer",
            minimum: 1,
            default: 40,
            description: "Maximum depth for following function call chains",
          },
          reportAllUnknownParams: {
            type: "boolean",
            default: false,
            description:
              "Report all unknown parameters, not just likely typos. When false (default), only reports parameters that appear to be typos based on similarity to available parameters.",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      not_found_param: `"{{param}}" not found in {{func}}()`,
      not_found_param_with_file: `"{{param}}" not found in {{func}}() (defined in {{filePath}})`,
      not_found_param_chain: `"{{param}}" not found in {{firstFunc}}() -> {{secondFunc}}()`,
      not_found_param_chain_with_file: `"{{param}}" not found in {{firstFunc}}() -> {{secondFunc}}() (defined in {{filePath}})`,
      not_found_param_long_chain: `"{{param}}" not found in {{firstFunc}}() -> ... -> {{lastFunc}}()`,
      not_found_param_long_chain_with_file: `"{{param}}" not found in {{firstFunc}}() -> ... -> {{lastFunc}}() (defined in {{filePath}})`,
      not_found_param_with_suggestions: `"{{param}}" not found in {{func}}(). Did you mean: {{suggestions}}?`,
      not_found_param_with_suggestions_and_file: `"{{param}}" not found in {{func}}() (defined in {{filePath}}). Did you mean: {{suggestions}}?`,
      not_found_param_chain_with_suggestions: `"{{param}}" not found in {{firstFunc}}() -> {{secondFunc}}(). Available parameters: {{available}}.`,
      not_found_param_chain_with_suggestions_and_file: `"{{param}}" not found in {{firstFunc}}() -> {{secondFunc}}() (defined in {{filePath}}). Available parameters: {{available}}.`,
      not_found_param_chain_long_with_suggestions: `"{{param}}" not found in {{firstFunc}}() -> ... -> {{lastFunc}}(). Available parameters: {{available}}.`,
      not_found_param_chain_long_with_suggestions_and_file: `"{{param}}" not found in {{firstFunc}}() -> ... -> {{lastFunc}}() (defined in {{filePath}}). Available parameters: {{available}}.`,
    },
  },

  create(context) {
    debug("Initializing noUnknownParamsRule for file:", context.getFilename());

    // Get configuration options with defaults
    const options = context.options[0] || {};
    const maxImportDepth = options.maxImportDepth || 12;
    const maxChainDepth = options.maxChainDepth || 40;
    const reportAllUnknownParams = options.reportAllUnknownParams || false;

    const functionDefinitions = new Map();
    const callsToAnalyze = [];
    const jsxElementsToAnalyze = [];

    return {
      // Collect function definitions
      "FunctionDeclaration"(node) {
        if (node.id && node.id.type === "Identifier") {
          functionDefinitions.set(node.id.name, {
            node,
            sourceFile: context.getFilename(),
          });
        }
      },

      // Handle variable declarations with function expressions
      "VariableDeclarator"(node) {
        if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "FunctionExpression" ||
            node.init.type === "ArrowFunctionExpression")
        ) {
          functionDefinitions.set(node.id.name, {
            node: node.init,
            sourceFile: context.getFilename(),
          });
        } else if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          node.init.type === "CallExpression"
        ) {
          // Handle wrapper functions like forwardRef(Component), memo(Component)
          const wrappedFunction = resolveWrapperFunction(node.init);
          if (wrappedFunction) {
            // console.log("Debug: Found wrapped function", node.id.name, "->", wrappedFunction);
            functionDefinitions.set(node.id.name, {
              node: wrappedFunction,
              sourceFile: context.getFilename(),
            });
          }
        }
      },

      // Handle exported function declarations
      "ExportNamedDeclaration"(node) {
        if (
          node.declaration?.type === "FunctionDeclaration" &&
          node.declaration.id?.name
        ) {
          functionDefinitions.set(node.declaration.id.name, {
            node: node.declaration,
            sourceFile: context.getFilename(),
          });
        } else if (node.declaration?.type === "VariableDeclaration") {
          for (const declarator of node.declaration.declarations) {
            if (
              declarator.id?.name &&
              (declarator.init?.type === "FunctionExpression" ||
                declarator.init?.type === "ArrowFunctionExpression")
            ) {
              functionDefinitions.set(declarator.id.name, {
                node: declarator.init,
                sourceFile: context.getFilename(),
              });
            }
          }
        }
      },

      "ExportDefaultDeclaration"(node) {
        if (
          node.declaration?.type === "FunctionDeclaration" &&
          node.declaration.id?.name
        ) {
          functionDefinitions.set(node.declaration.id.name, {
            node: node.declaration,
            sourceFile: context.getFilename(),
          });
        }
      },

      // Collect call expressions to analyze later
      "CallExpression"(node) {
        const callee = node.callee;

        if (callee.type !== "Identifier") return;

        callsToAnalyze.push(node);
      },

      // Collect JSX elements to analyze later
      "JSXElement"(node) {
        const openingElement = node.openingElement;
        if (!openingElement || !openingElement.name) return;

        // Only handle JSXIdentifier (component names like <Toto />)
        if (openingElement.name.type !== "JSXIdentifier") return;

        jsxElementsToAnalyze.push(node);
      },

      // Analyze all collected calls and JSX after collecting all function definitions
      "Program:exit"() {
        try {
          debug("=== Starting Program:exit analysis ===");
          debug(
            "Collected function definitions before import resolution:",
            Array.from(functionDefinitions.keys()),
          );
          debug("Collected calls to analyze:", callsToAnalyze.length);

          // First, resolve import statements to get imported function definitions
          resolveImports(context, functionDefinitions, maxImportDepth);

          debug(
            "Function definitions after import resolution:",
            Array.from(functionDefinitions.keys()),
          );
          for (const [name, def] of functionDefinitions) {
            debug(
              `  - ${name}: isExternal=${Boolean(def.isExternal)}, sourceFile=${def.sourceFile}`,
            );
          }

          // Then, resolve wrapper function references
          resolveWrapperReferences(functionDefinitions);

          // Process all collected function calls
          debug("=== Processing function calls ===");
          for (const callNode of callsToAnalyze) {
            const funcName = callNode.callee?.name;
            debug(
              `Analyzing call to: ${funcName} at line ${callNode.loc?.start?.line}`,
            );
            analyzeCallExpression(
              callNode,
              functionDefinitions,
              context,
              maxChainDepth,
              { reportAllUnknownParams },
            );
          }

          // Process all collected JSX elements
          for (const jsxNode of jsxElementsToAnalyze) {
            analyzeJSXElement(
              jsxNode,
              functionDefinitions,
              context,
              maxChainDepth,
              { reportAllUnknownParams },
            );
          }
        } finally {
          // Clean up per-file analysis state to prevent memory leaks
          functionDefinitions.clear();
          callsToAnalyze.length = 0;
          jsxElementsToAnalyze.length = 0;

          // Schedule cache cleanup (but keep fileParseCache for reuse across files)
          scheduleMemoryCleanup();
        }
      },
    };
  },
};
