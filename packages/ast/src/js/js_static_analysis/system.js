import { isStringLiteralNode } from "./helpers.js"

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
      const specifierNode = element
      onUrl({
        type: "js_url",
        subtype: "system_register_arg",
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
    const specifierNode = firstArgNode
    onUrl({
      type: "js_url",
      subtype: "system_import_arg",
      expectedType: "js_classic",
      specifier: specifierNode.value,
      specifierStart: specifierNode.start,
      specifierEnd: specifierNode.end,
      specifierLine: specifierNode.loc.start.line,
      specifierColumn: specifierNode.loc.start.column,
    })
  }
}

export const isSystemResolveCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "MemberExpression" &&
    callee.object.object.type === "Identifier" &&
    // because of minification we can't assume _context.
    // so anything matching "*.meta.resolve()"
    // will be assumed to be the equivalent to "meta.resolve()"
    // callee.object.object.name === "_context" &&
    callee.object.property.type === "Identifier" &&
    callee.object.property.name === "meta" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "resolve"
  )
}
export const analyzeSystemResolveCall = (node, { onUrl }) => {
  const firstArgNode = node.arguments[0]
  if (isStringLiteralNode(firstArgNode)) {
    const specifierNode = firstArgNode
    onUrl({
      type: "js_url",
      subtype: "system_resolve_arg",
      specifier: specifierNode.value,
      specifierStart: specifierNode.start,
      specifierEnd: specifierNode.end,
      specifierLine: specifierNode.loc.start.line,
      specifierColumn: specifierNode.loc.start.column,
    })
  }
}
