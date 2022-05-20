import { getNodePosition, isStringLiteralNode } from "./helpers.js"

export const isSystemRegisterCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "System" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "register"
  )
}
export const analyzeSystemRegisterCall = (node, { onUrl }) => {
  const firstArgNode = node.arguments[0]
  if (firstArgNode.type === "ArrayExpression") {
    analyzeSystemRegisterDeps(firstArgNode, { onUrl })
    return
  }
  if (isStringLiteralNode(firstArgNode)) {
    const secondArgNode = node.arguments[1]
    if (secondArgNode.type === "ArrayExpression") {
      analyzeSystemRegisterDeps(secondArgNode, { onUrl })
      return
    }
  }
}
const analyzeSystemRegisterDeps = (node, { onUrl }) => {
  const elements = node.elements
  elements.forEach((element) => {
    if (isStringLiteralNode(element)) {
      onUrl({
        node: element,
        ...getNodePosition(element),
        type: "js_url_specifier",
        subtype: "system_register_arg",
        expectedType: "js_classic",
        specifier: element.value,
      })
    }
  })
}

export const isSystemImportCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    // because of minification we can't assume _context.
    // so anything matching "*.import()"
    // will be assumed to be the equivalent to "import()"
    // callee.object.name === "_context" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "import"
  )
}
export const analyzeSystemImportCall = (node, { onUrl }) => {
  const firstArgNode = node.arguments[0]
  if (isStringLiteralNode(firstArgNode)) {
    onUrl({
      node: firstArgNode,
      ...getNodePosition(firstArgNode),
      type: "js_url_specifier",
      subtype: "system_import_arg",
      expectedType: "js_classic",
      specifier: firstArgNode.value,
    })
  }
}
