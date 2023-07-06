import { isStringLiteralNode } from "./helpers.js";

export const isImportMetaResolveCall = (node) => {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "MetaProperty" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "resolve"
  );
};

export const analyzeImportMetaResolveCall = (node, { onUrl }) => {
  const firstArg = node.arguments[0];
  if (firstArg && isStringLiteralNode(firstArg)) {
    onUrl({
      type: "js_import",
      subtype: "import_meta_resolve",
      specifier: firstArg.value,
      start: firstArg.start,
      end: firstArg.end,
      line: firstArg.loc.start.line,
      column: firstArg.loc.start.column,
      astNodes: { node },
    });
  }
};
