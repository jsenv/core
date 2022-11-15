import { isStringLiteralNode } from "./helpers.js"

export const isImportMetaResolveCall = (node) => {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "MetaProperty" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "resolve"
  )
}

export const analyzeImportMetaResolveCall = (node, { onUrl }) => {
  const firstArg = node.arguments[0]
  if (firstArg && isStringLiteralNode(firstArg)) {
    onUrl({
      node,
      type: "js_import",
      subtype: "import_meta_resolve",
      specifier: firstArg.value,
      specifierStart: firstArg.start,
      specifierEnd: firstArg.end,
      specifierLine: firstArg.loc.start.line,
      specifierColumn: firstArg.loc.start.column,
    })
  }
}
