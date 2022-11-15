import { isStringLiteralNode } from "./helpers.js"

export const isImportMetaResolveCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "MetaProperty" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "resolve"
  )
}

export const analyzeImportMetaResolveCall = (node, { onUrl }) => {
  const firstArg = node.arguments[0]
  if (firstArg && isStringLiteralNode(firstArg)) {
    onUrl({
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
