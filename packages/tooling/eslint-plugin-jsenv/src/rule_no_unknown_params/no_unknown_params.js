import { analyzeCallExpression, analyzeJSXElement } from "./utils/analysis.js";
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
    schema: [],
    messages: {
      not_found_param: "{{param}} does not exist in {{func}}()",
      not_found_param_chain:
        "{{param}} does not exist in {{firstFunc}}() -> {{secondFunc}}()",
      not_found_param_long_chain:
        "{{param}} does not exist in {{firstFunc}}() -> ... -> {{lastFunc}}()",
      not_found_param_with_suggestions:
        "{{param}} does not exist in {{func}}(). Did you mean: {{suggestions}}?",
      not_found_param_chain_with_suggestions:
        "{{param}} does not exist in {{firstFunc}}() -> {{secondFunc}}(). Available parameters: {{available}}.",
      not_found_param_chain_long_with_suggestions:
        "{{param}} does not exist in {{firstFunc}}() -> ... -> {{lastFunc}}(). Available parameters: {{available}}.",
      superfluous_param:
        "{{param}} is superfluous. {{func}}() only accepts: {{expected}}.",
      superfluous_param_chain:
        "{{param}} is superfluous. {{firstFunc}}() -> {{secondFunc}}() only accepts: {{expected}}.",
      superfluous_param_long_chain:
        "{{param}} is superfluous. {{firstFunc}}() -> ... -> {{lastFunc}}() only accepts: {{expected}}.",
    },
  },

  create(context) {
    const functionDefinitions = new Map();
    const callsToAnalyze = [];
    const jsxElementsToAnalyze = [];

    return {
      // Collect function definitions
      "FunctionDeclaration"(node) {
        if (node.id && node.id.name) {
          functionDefinitions.set(node.id.name, node);
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
          functionDefinitions.set(node.id.name, node.init);
        } else if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          node.init.type === "CallExpression"
        ) {
          // Handle wrapper functions like forwardRef(Component), memo(Component)
          const wrappedFunction = resolveWrapperFunction(node.init);
          if (wrappedFunction) {
            functionDefinitions.set(node.id.name, wrappedFunction);
          }
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
        // First, resolve wrapper function references
        resolveWrapperReferences(functionDefinitions);

        // Process all collected function calls
        for (const callNode of callsToAnalyze) {
          analyzeCallExpression(callNode, functionDefinitions, context);
        }

        // Process all collected JSX elements
        for (const jsxNode of jsxElementsToAnalyze) {
          analyzeJSXElement(jsxNode, functionDefinitions, context);
        }
      },
    };
  },
};
