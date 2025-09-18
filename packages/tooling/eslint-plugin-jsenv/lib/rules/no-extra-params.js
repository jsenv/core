// Helper function to find variable declarations in a function that match a name
function findVariableDeclarationsInFunction(functionNode, varName) {
  let found = false;

  function traverse(node) {
    if (found) return;

    if (!node || typeof node !== "object") return;

    // Check for variable declarators
    if (
      node.type === "VariableDeclarator" &&
      node.id &&
      node.id.type === "Identifier" &&
      node.id.name === varName
    ) {
      found = true;
      return;
    }

    // Check for destructuring assignments
    if (
      node.type === "VariableDeclarator" &&
      node.id &&
      node.id.type === "ObjectPattern"
    ) {
      for (const prop of node.id.properties) {
        if (
          prop.type === "Property" &&
          prop.key &&
          prop.key.type === "Identifier" &&
          prop.key.name === varName
        ) {
          found = true;
          return;
        }
      }
    }

    // Traverse child nodes
    for (const key in node) {
      if (key === "parent") continue; // Avoid infinite loops
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

  traverse(functionNode);
  return found;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing extra params not used in function definition",
      category: "Possible Errors",
      recommended: false,
    },
    schema: [],
    messages: {
      extraParam: "'{{param}}' is passed but not used in '{{func}}'.",
    },
  },

  create(context) {
    const functionDefinitions = new Map();

    return {
      // Collect function definitions
      FunctionDeclaration(node) {
        if (node.id && node.id.name) {
          functionDefinitions.set(node.id.name, node);
        }
      },

      // Handle variable declarations with function expressions
      VariableDeclarator(node) {
        if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "FunctionExpression" ||
            node.init.type === "ArrowFunctionExpression")
        ) {
          functionDefinitions.set(node.id.name, node.init);
        }
      },

      // Check call expressions
      CallExpression(node) {
        const callee = node.callee;

        if (callee.type !== "Identifier") return;

        const funcName = callee.name;
        const functionDef = functionDefinitions.get(funcName);

        if (!functionDef) return;

        // Check if this call is inside the function that we're tracking
        // and if that function has variable declarations that shadow the function name
        let parent = node.parent;
        let isInsideTrackedFunction = false;
        while (parent) {
          if (parent === functionDef) {
            isInsideTrackedFunction = true;
            break;
          }
          parent = parent.parent;
        }

        if (isInsideTrackedFunction) {
          // Look for variable declarations inside this function that declare the same name
          const hasShadowingVariable = findVariableDeclarationsInFunction(
            functionDef,
            funcName,
          );
          if (hasShadowingVariable) {
            return; // The function name is shadowed, so this call doesn't refer to our tracked function
          }
        }

        const params = functionDef.params;
        if (params.length === 0 || node.arguments.length === 0) return;

        // Check each parameter that has object destructuring
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          const arg = node.arguments[i];

          // Only check ObjectPattern parameters
          if (param.type !== "ObjectPattern") {
            continue;
          }

          // Only check ObjectExpression arguments
          if (!arg || arg.type !== "ObjectExpression") {
            continue;
          }

          // Check if this ObjectPattern has a rest element (...rest)
          const hasRestElement = param.properties.some(
            (p) => p.type === "RestElement",
          );

          // If there's a rest element, all properties are considered valid
          if (hasRestElement) {
            continue;
          }

          const allowedProps = new Set(
            param.properties
              .map((p) =>
                p.key && p.key.type === "Identifier" ? p.key.name : null,
              )
              .filter((name) => name !== null),
          );

          for (const prop of arg.properties) {
            if (prop.key && prop.key.type === "Identifier") {
              const keyName = prop.key.name;
              if (!allowedProps.has(keyName)) {
                context.report({
                  node: prop,
                  messageId: "extraParam",
                  data: { param: keyName, func: funcName },
                });
              }
            }
          }
        }
      },
    };
  },
};
