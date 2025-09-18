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

        const params = functionDef.params;
        if (params.length === 0 || node.arguments.length === 0) return;

        // Check each parameter that has object destructuring
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          const arg = node.arguments[i];

          // Only check ObjectPattern parameters
          if (param.type !== "ObjectPattern") continue;

          // Only check ObjectExpression arguments
          if (!arg || arg.type !== "ObjectExpression") continue;

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
