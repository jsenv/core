import { getTypePropertyNode } from "@jsenv/utils/js_ast/js_ast.js"

export const analyzeNewWorkerCall = (path) => {
  const node = path.node
  if (!isNewWorkeCall(node)) {
    return null
  }
  const referenceInfos = []
  let expectedType
  let typeArgNode
  const secondArgNode = node.arguments[1]
  if (secondArgNode) {
    typeArgNode = getTypePropertyNode(secondArgNode)
    if (typeArgNode && typeArgNode.value.type === "StringLiteral") {
      const typeArgValue = typeArgNode.value.value
      expectedType =
        typeArgValue === "classic"
          ? "js_classic"
          : typeArgValue === "module"
          ? "js_module"
          : undefined
    }
  }
  const firstArgNode = node.arguments[0]
  if (firstArgNode.type === "StringLiteral") {
    referenceInfos.push({
      type: "js_url_specifier",
      subtype: "new_worker_first_arg",
      specifierNode: firstArgNode,
      typeArgNode,
      expectedType,
      expectedSubtype: "worker",
    })
    return referenceInfos
  }
  const newUrlReferenceInfos = analyzeNewUrlCall(path.get("arguments")[0])
  if (!newUrlReferenceInfos) {
    return null
  }
  newUrlReferenceInfos.forEach((newUrlReferenceInfo) => {
    Object.assign(newUrlReferenceInfo, {
      typeArgNode,
      expectedType,
      expectedSubtype: "worker",
    })
  })
  return newUrlReferenceInfos
}
const isNewWorkeCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "Worker"
  )
}

export const analyzeNewUrlCall = (path) => {
  const node = path.node
  if (!isNewUrlCall(node)) {
    return null
  }
  const parentPath = path.parentPath
  const parentNode = parentPath.node
  if (isNewWorkeCall(parentNode)) {
    // already found while parsing worker arguments
    return null
  }

  const referenceInfos = []
  if (node.arguments.length === 1) {
    const firstArgNode = node.arguments[0]
    const urlType = analyzeUrlNodeType(firstArgNode)
    if (urlType === "StringLiteral") {
      referenceInfos.push({
        type: "js_url_specifier",
        subtype: "new_url_first_arg",
        specifierNode: firstArgNode,
      })
    }
    return referenceInfos
  }
  if (node.arguments.length === 2) {
    const firstArgNode = node.arguments[0]
    const secondArgNode = node.arguments[1]
    const baseUrlType = analyzeUrlNodeType(secondArgNode)
    if (baseUrlType) {
      // we can understand the second argument
      const urlType = analyzeUrlNodeType(firstArgNode)
      if (urlType === "StringLiteral") {
        // we can understand the first argument
        referenceInfos.push({
          type: "js_url_specifier",
          subtype: "new_url_first_arg",
          specifierNode: firstArgNode,
          baseUrlType,
          baseUrl:
            baseUrlType === "StringLiteral" ? secondArgNode.value : undefined,
        })
      }
      if (baseUrlType === "StringLiteral") {
        referenceInfos.push({
          type: "js_url_specifier",
          subtype: "new_url_second_arg",
          specifierNode: secondArgNode,
        })
      }
    }
  }
  return referenceInfos
}
const isNewUrlCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL"
  )
}

const analyzeUrlNodeType = (secondArgNode) => {
  if (secondArgNode.type === "StringLiteral") {
    return "StringLiteral"
  }
  if (
    secondArgNode.type === "MemberExpression" &&
    secondArgNode.object.type === "MetaProperty" &&
    secondArgNode.property.type === "Identifier" &&
    secondArgNode.property.name === "url"
  ) {
    return "import.meta.url"
  }
  if (
    secondArgNode.type === "MemberExpression" &&
    secondArgNode.object.type === "Identifier" &&
    secondArgNode.object.name === "window" &&
    secondArgNode.property.type === "Identifier" &&
    secondArgNode.property.name === "origin"
  ) {
    return "window.origin"
  }
  return null
}
