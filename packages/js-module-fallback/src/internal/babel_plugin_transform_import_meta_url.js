import { parseExpression } from "@babel/parser";

export const babelPluginTransformImportMetaUrl = (babel) => {
  return {
    name: "transform-import-meta-url",
    visitor: {
      Program: (programPath) => {
        const currentUrlIdentifier =
          programPath.scope.generateUidIdentifier("currentUrl");
        let used = false;

        programPath.traverse({
          MemberExpression: (path) => {
            const node = path.node;
            if (
              node.object.type === "MetaProperty" &&
              node.object.property.name === "meta" &&
              node.property.name === "url"
            ) {
              // const node = babel.types.valueToNode(10)
              const identifier = babel.types.identifier(
                currentUrlIdentifier.name,
              );
              const expressionStatement =
                babel.types.expressionStatement(identifier);
              path.replaceWith(expressionStatement);
              used = true;
            }
          },
        });
        if (used) {
          const ast = generateExpressionAst(`document.currentScript.src`);
          programPath.scope.push({
            id: currentUrlIdentifier,
            init: ast,
          });
        }
      },
    },
  };
};

const generateExpressionAst = (expression, options) => {
  const ast = parseExpression(expression, options);
  return ast;
};
