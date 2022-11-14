import { isStringLiteralNode } from "./helpers.js"

export const isImportScriptsCall = (node) => {
  const callee = node.callee
  if (callee.type === "Identifier" && callee.name === "importScripts") {
    return true
  }
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "self" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "importScripts"
  )
}
export const analyzeImportScriptCalls = (node, { onUrl }) => {
  node.arguments.forEach((arg) => {
    if (isStringLiteralNode(arg)) {
      const specifierNode = arg
      onUrl({
        type: "js_url",
        subtype: "self_import_scripts_arg",
        expectedType: "js_classic",
        specifier: specifierNode.value,
        specifierStart: specifierNode.start,
        specifierEnd: specifierNode.end,
        specifierLine: specifierNode.loc.start.line,
        specifierColumn: specifierNode.loc.start.column,
      })
    }
  })
}
