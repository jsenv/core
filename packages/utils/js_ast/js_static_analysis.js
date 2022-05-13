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

export const analyzeNewWorkerOrNewSharedWorker = (path) => {
  const node = path.node
  if (!isNewWorkerOrNewSharedWorker(node)) {
    return null
  }
  return analyzeWorkerCallArguments(
    path,
    node.callee.name === "Worker" ? "worker" : "shared_worker",
  )
}
const isNewWorkerOrNewSharedWorker = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    (node.callee.name === "Worker" || node.callee.name === "SharedWorker")
  )
}

const analyzeWorkerCallArguments = (path, workerType) => {
  const node = path.node
  const mentions = []
  let expectedType = "js_classic"
  let typeArgNode
  const secondArgNode = node.arguments[1]
  if (secondArgNode) {
    typeArgNode = getTypePropertyNode(secondArgNode)
    if (typeArgNode && typeArgNode.value.type === "StringLiteral") {
      const typeArgValue = typeArgNode.value.value
      if (typeArgValue === "module") {
        expectedType = "js_module"
      }
    }
  }

  const { referenceSubtype, expectedSubtype } = {
    worker: {
      referenceSubtype: "new_worker_first_arg",
      expectedSubtype: "worker",
    },
    shared_worker: {
      referenceSubtype: "new_shared_worker_first_arg",
      expectedSubtype: "shared_worker",
    },
    service_worker: {
      referenceSubtype: "service_worker_register_first_arg",
      expectedSubtype: "service_worker",
    },
  }[workerType]

  const firstArgNode = node.arguments[0]
  if (firstArgNode.type === "StringLiteral") {
    mentions.push({
      type: "js_url_specifier",
      subtype: referenceSubtype,
      expectedType,
      expectedSubtype,
      specifier: firstArgNode.value,
      ...getNodePosition(firstArgNode),
      typeArgNode,
    })
    return mentions
  }
  const newUrlMentions = analyzeNewUrlCall(path.get("arguments")[0], {
    ignoreInsideWorker: false,
  })
  if (!newUrlMentions) {
    return null
  }
  newUrlMentions.forEach((mention) => {
    Object.assign(mention, {
      expectedType,
      expectedSubtype,
      typeArgNode,
    })
  })
  return newUrlMentions
}

export const analyzeServiceWorkerRegisterCall = (path) => {
  const node = path.node
  if (!isServiceWorkerRegisterCall(node)) {
    return null
  }
  return analyzeWorkerCallArguments(path, "service_worker")
}
const isServiceWorkerRegisterCall = (node) => {
  if (node.type !== "CallExpression") {
    return false
  }
  const callee = node.callee
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "register"
  ) {
    const parentObject = callee.object
    if (parentObject.type === "MemberExpression") {
      const parentProperty = parentObject.property
      if (
        parentProperty.type === "Identifier" &&
        parentProperty.name === "serviceWorker"
      ) {
        const grandParentObject = parentObject.object
        if (grandParentObject.type === "MemberExpression") {
          // window.navigator.serviceWorker.register
          const grandParentProperty = grandParentObject.property
          if (
            grandParentProperty.type === "Identifier" &&
            grandParentProperty.name === "navigator"
          ) {
            const ancestorObject = grandParentObject.object
            if (
              ancestorObject.type === "Identifier" &&
              ancestorObject.name === "window"
            ) {
              return true
            }
          }
        }
        if (grandParentObject.type === "Identifier") {
          // navigator.serviceWorker.register
          if (grandParentObject.name === "navigator") {
            return true
          }
        }
      }
    }
  }
  return false
}

export const analyzeNewUrlCall = (
  path,
  { searchSystemJs = false, ignoreInsideWorker = true } = {},
) => {
  const node = path.node
  if (!isNewUrlCall(node)) {
    return null
  }
  if (ignoreInsideWorker) {
    const parentPath = path.parentPath
    const parentNode = parentPath.node
    if (
      isNewWorkerOrNewSharedWorker(parentNode) ||
      isServiceWorkerRegisterCall(parentNode)
    ) {
      // already found while parsing new Worker|SharedWorker arguments
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
    const baseUrlType = analyzeUrlNodeType(secondArgNode, { searchSystemJs })
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
const analyzeUrlNodeType = (secondArgNode, { searchSystemJs = false } = {}) => {
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
    searchSystemJs &&
    secondArgNode.type === "MemberExpression" &&
    secondArgNode.object.type === "MemberExpression" &&
    secondArgNode.object.object.type === "Identifier" &&
    // because of minification we can't assume _context.
    // so anything matching "*.meta.url" (in the context of new URL())
    // will be assumed to be the equivalent to "import.meta.url"
    // secondArgNode.object.object.name === "_context" &&
    secondArgNode.object.property.type === "Identifier" &&
    secondArgNode.object.property.name === "meta" &&
    secondArgNode.property.type === "Identifier" &&
    secondArgNode.property.name === "url"
  ) {
    return "context.meta.url"
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
        type: "js_url_specifier",
        subtype: "self_import_scripts_arg",
        expectedType: "js_classic",
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
  if (firstArgNode.type === "ArrayExpression") {
    return analyzeSystemRegisterDeps(firstArgNode)
  }
  if (firstArgNode.type === "StringLiteral") {
    const secondArgNode = node.arguments[1]
    if (secondArgNode.type === "ArrayExpression") {
      return analyzeSystemRegisterDeps(secondArgNode)
    }
  }
  return null
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
const analyzeSystemRegisterDeps = (node) => {
  const mentions = []
  const elements = node.elements
  elements.forEach((element) => {
    if (element.type === "StringLiteral") {
      mentions.push({
        type: "js_url_specifier",
        subtype: "system_register_arg",
        expectedType: "js_classic",
        specifier: element.value,
        ...getNodePosition(element),
      })
    }
  })
  return mentions
}

export const analyzeSystemImportCall = (path) => {
  const node = path.node
  if (!isSystemImportCall(node)) {
    return null
  }
  const mentions = []
  const firstArgNode = node.arguments[0]
  if (firstArgNode.type === "StringLiteral") {
    mentions.push({
      type: "js_url_specifier",
      subtype: "system_import_arg",
      expectedType: "js_classic",
      specifier: firstArgNode.value,
      ...getNodePosition(firstArgNode),
    })
  }
  return mentions
}
const isSystemImportCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "_context" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "import"
  )
}

export const analyzeSystemNewUrlCall = () => {
  // TODO: new URL(specifier, _context.meta.url)
  // apparently it won't recognize the service worker without this so I have to take that into account
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
