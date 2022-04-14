// TODO: add navigator.serviceWorker.register

import { getTypePropertyNode } from "./js_ast.js"

export const analyzeImportCall = (path) => {
  const node = path.node
  if (!isImportCall(node)) {
    return null
  }
  const specifierNode = node.arguments[0]
  if (specifierNode.type === "StringLiteral") {
    return {
      type: "js_import_export",
      subtype: "import_dynamic",
      specifier: specifierNode.value,
      ...getNodePosition(specifierNode),
    }
  }
  // Non-string argument, probably a variable or expression, e.g.
  // import(moduleId)
  // import('./' + moduleName)
  return null
}
export const isImportCall = (node) => {
  return node.callee.type === "Import"
}

export const analyzeImportExportDeclaration = (path) => {
  const node = path.node
  const type = node.type
  const handlers = {
    ExportAllDeclaration: (path) => {
      const specifierNode = path.node.source
      return {
        type: "js_import_export",
        subtype: "export_all",
        specifier: specifierNode.value,
        ...getNodePosition(specifierNode),
      }
    },
    ExportNamedDeclaration: (path) => {
      const specifierNode = path.node.source
      if (!specifierNode) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return null
      }
      return {
        type: "js_import_export",
        subtype: "export_named",
        specifier: specifierNode.value,
        ...getNodePosition(specifierNode),
      }
    },
    ImportDeclaration: (path) => {
      const specifierNode = path.node.source
      return {
        type: "js_import_export",
        subtype: "import_static",
        specifier: specifierNode.value,
        ...getNodePosition(specifierNode),
      }
    },
  }
  const handler = handlers[type]
  return handler ? handler(path) : null
}

export const analyzeNewWorkerCall = (path) => {
  const node = path.node
  if (!isNewWorkerCall(node)) {
    return null
  }
  const mentions = []
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
    mentions.push({
      type: "js_url_specifier",
      subtype: "new_worker_first_arg",
      expectedType,
      expectedSubtype: "worker",
      specifier: firstArgNode.value,
      ...getNodePosition(firstArgNode),
    })
    return mentions
  }
  const newUrlMentions = analyzeNewUrlCall(path.get("arguments")[0], {
    allowInsideWorker: true,
  })
  if (!newUrlMentions) {
    return null
  }
  newUrlMentions.forEach((mention) => {
    Object.assign(mention, {
      typeArgNode,
      expectedType,
      expectedSubtype: "worker",
    })
  })
  return newUrlMentions
}
const isNewWorkerCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "Worker"
  )
}

export const analyzeNewUrlCall = (path, { allowInsideWorker = false } = {}) => {
  const node = path.node
  if (!isNewUrlCall(node)) {
    return null
  }
  if (!allowInsideWorker) {
    const parentPath = path.parentPath
    const parentNode = parentPath.node
    if (isNewWorkerCall(parentNode)) {
      // already found while parsing worker arguments
      return null
    }
  }

  const mentions = []
  if (node.arguments.length === 1) {
    const firstArgNode = node.arguments[0]
    const urlType = analyzeUrlNodeType(firstArgNode)
    if (urlType === "StringLiteral") {
      mentions.push({
        type: "js_url_specifier",
        subtype: "new_url_first_arg",
        specifier: firstArgNode.value,
        ...getNodePosition(firstArgNode),
      })
    }
    return mentions
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
        mentions.push({
          type: "js_url_specifier",
          subtype: "new_url_first_arg",
          specifier: firstArgNode.value,
          ...getNodePosition(firstArgNode),
          baseUrlType,
          baseUrl:
            baseUrlType === "StringLiteral" ? secondArgNode.value : undefined,
        })
      }
      if (baseUrlType === "StringLiteral") {
        mentions.push({
          type: "js_url_specifier",
          subtype: "new_url_second_arg",
          specifier: secondArgNode.value,
          ...getNodePosition(secondArgNode),
        })
      }
    }
  }
  return mentions
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

export const analyzeImportScriptCalls = (path) => {
  const node = path.node
  if (!isImportScriptsCall(node)) {
    return null
  }
  const mentions = []
  node.arguments.forEach((arg) => {
    if (arg.type === "StringLiteral") {
      mentions.push({
        type: "js_url",
        subtype: "self_import_scripts_arg",
        specifier: arg.value,
        ...getNodePosition(arg),
      })
    }
  })
  return mentions
}
const isImportScriptsCall = (node) => {
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

export const analyzeSystemRegisterCall = (path) => {
  const node = path.node
  if (!isSystemRegisterCall(node)) {
    return null
  }
  const firstArgNode = node.arguments[0]
  if (firstArgNode.type !== "ArrayExpression") {
    return null
  }
  const mentions = []
  const elements = firstArgNode.elements
  elements.forEach((element) => {
    if (element.type === "StringLiteral") {
      mentions.push({
        type: "js_url",
        subtype: "system_register_arg",
        specifier: element.value,
        ...getNodePosition(element),
      })
    }
  })
  return mentions
}
const isSystemRegisterCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "System" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "register"
  )
}

const getNodePosition = (node) => {
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
    lineEnd: node.loc.end.line,
    columnEnd: node.loc.end.column,
  }
}
