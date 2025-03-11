export const babelPluginTransformImportMetaResolve = () => {
  return {
    name: "transform-import-meta-resolve",
    visitor: {
      Program: (programPath) => {
        programPath.traverse({
          MemberExpression: (path) => {
            const node = path.node;
            if (
              node.object.type === "MetaProperty" &&
              node.object.property.name === "meta" &&
              node.property.name === "resolve"
            ) {
              const firstArg = node.arguments[0];
              if (firstArg && firstArg.type === "StringLiteral") {
                path.replaceWithSourceString(
                  `new URL(${firstArg.value}, document.currentScript.src).href`,
                );
              }
            }
          },
        });
      },
    },
  };
};
