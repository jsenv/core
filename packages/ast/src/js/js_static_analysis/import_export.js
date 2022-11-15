import { isStringLiteralNode } from "./helpers.js"

export const analyzeImportDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source
  const assertionInfo = extractImportAssertionsInfo(node)
  onUrl({
    type: "js_import",
    subtype: "import_static",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
    expectedType: assertionInfo ? assertionInfo.assert.type : "js_module",
    ...assertionInfo,
  })
}
export const analyzeImportExpression = (node, { onUrl }) => {
  const specifierNode = node.source
  if (!isStringLiteralNode(specifierNode)) {
    return
  }
  const assertionInfo = extractImportAssertionsInfo(node)

  onUrl({
    type: "js_import",
    subtype: "import_dynamic",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
    expectedType: assertionInfo ? assertionInfo.assert.type : "js_module",
    ...assertionInfo,
  })
}
export const analyzeExportNamedDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source
  if (!specifierNode) {
    // This export has no "source", so it's probably
    // a local variable or function, e.g.
    // export { varName }
    // export const constName = ...
    // export function funcName() {}
    return
  }
  onUrl({
    type: "js_import",
    subtype: "export_named",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
  })
}
export const analyzeExportAllDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source
  onUrl({
    type: "js_import",
    subtype: "export_all",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
  })
}

const extractImportAssertionsInfo = (node) => {
  if (node.type === "ImportDeclaration") {
    // static import
    const { assertions } = node
    if (!assertions) {
      return null
    }
    if (assertions.length === 0) {
      return null
    }
    const typeAssertionNode = assertions.find(
      (assertion) => assertion.key.name === "type",
    )
    if (!typeAssertionNode) {
      return null
    }
    const typeNode = typeAssertionNode.value
    if (!isStringLiteralNode(typeNode)) {
      return null
    }
    return {
      assertNode: typeAssertionNode,
      assert: {
        type: typeNode.value,
      },
    }
  }
  // dynamic import
  const args = node.arguments
  if (!args) {
    // acorn keeps node.arguments undefined for dynamic import without a second argument
    return null
  }
  const firstArgNode = args[0]
  if (!firstArgNode) {
    return null
  }
  const { properties } = firstArgNode
  const assertProperty = properties.find((property) => {
    return property.key.name === "assert"
  })
  if (!assertProperty) {
    return null
  }
  const assertValueNode = assertProperty.value
  if (assertValueNode.type !== "ObjectExpression") {
    return null
  }
  const assertValueProperties = assertValueNode.properties
  const typePropertyNode = assertValueProperties.find((property) => {
    return property.key.name === "type"
  })
  if (!typePropertyNode) {
    return null
  }
  const typePropertyValue = typePropertyNode.value
  if (!isStringLiteralNode(typePropertyValue)) {
    return null
  }
  return {
    assertNode: firstArgNode,
    assert: {
      type: typePropertyValue.value,
    },
  }
}
