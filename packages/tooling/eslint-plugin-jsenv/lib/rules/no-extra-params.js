export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing extra params not used in function definition",
      category: "Possible Errors",
      recommended: false,
    },
    schema: [], // pas d'options pour le moment
    messages: {
      extraParam: "'{{param}}' is passed but not used in '{{func}}'.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        // On ne traite que les fonctions identifiées dans le même scope
        if (callee.type !== "Identifier") return;

        const funcName = callee.name;
        const scope = context.getScope();
        const funcDef = scope.set.get(funcName);

        if (!funcDef || !funcDef.defs.length) return;
        const defNode = funcDef.defs[0].node;

        // Vérifie si c'est une FunctionDeclaration ou FunctionExpression
        if (
          defNode.type !== "FunctionDeclaration" &&
          defNode.type !== "FunctionExpression" &&
          defNode.type !== "ArrowFunctionExpression"
        ) {
          return;
        }

        const params = defNode.params;
        if (params.length === 0) return;

        // Cas spécifique: destructuring { a, b }
        const firstParam = params[0];
        if (firstParam.type !== "ObjectPattern") return;

        const allowedProps = new Set(
          firstParam.properties.map((p) => p.key.name),
        );

        const arg = node.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") return;

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
      },
    };
  },
};
