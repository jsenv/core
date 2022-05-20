import { getNodePosition, isStringLiteralNode } from "./helpers.js"

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
      onUrl({
        node: arg,
        ...getNodePosition(arg),
        type: "js_url_specifier",
        subtype: "self_import_scripts_arg",
        expectedType: "js_classic",
        specifier: arg.value,
      })
    }
  })
}
