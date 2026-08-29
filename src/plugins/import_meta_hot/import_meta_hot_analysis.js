import { getImportMetaPropertyName, visitJsAst } from "@jsenv/ast";

export const analyzeImportMetaHot = (ast) => {
  const importMetaHotNodes = [];
  let hotDecline = false;
  let hotAcceptSelf = false;
  let hotAcceptSpecifiers = [];
  visitJsAst(ast, {
    MemberExpression: (node) => {
      if (getImportMetaPropertyName(node) === "hot") {
        importMetaHotNodes.push(node);
      }
    },
    CallExpression: (node) => {
      const methodName = getImportMetaHotMethodName(node);
      if (methodName === "accept") {
        const args = node.arguments;
        if (args.length === 0) {
          hotAcceptSelf = true;
          return;
        }
        const [firstArg] = args;
        if (isStringLiteral(firstArg)) {
          hotAcceptSpecifiers = [firstArg.value];
          return;
        }
        if (firstArg.type === "ArrayExpression") {
          hotAcceptSpecifiers = firstArg.elements.map((element) => {
            if (!isStringLiteral(element)) {
              throw new Error(
                `all array elements must be strings in "import.meta.hot.accept(array)"`,
              );
            }
            return element.value;
          });
          return;
        }
        // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.hot.accept(cb)`
        hotAcceptSelf = true;
        return;
      }
      if (methodName === "decline") {
        hotDecline = true;
      }
    },
  });
  return {
    importMetaHotNodes,
    hotDecline,
    hotAcceptSelf,
    hotAcceptSpecifiers,
  };
};

// "import.meta.hot.<method>(...)"
const getImportMetaHotMethodName = (callNode) => {
  const { callee } = callNode;
  if (callee.type !== "MemberExpression" || callee.computed) {
    return null;
  }
  if (getImportMetaPropertyName(callee.object) !== "hot") {
    return null;
  }
  return callee.property.name;
};

const isStringLiteral = (node) => {
  return node.type === "Literal" && typeof node.value === "string";
};
