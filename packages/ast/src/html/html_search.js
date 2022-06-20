import { getAttributeByName } from "./html_attributes.js"

export const visitNodes = (htmlAst, callback) => {
  const visitNode = (node) => {
    const callbackReturnValue = callback(node)
    if (callbackReturnValue === "stop") {
      return
    }
    const { childNodes } = node
    if (childNodes) {
      let i = 0
      while (i < childNodes.length) {
        visitNode(childNodes[i++])
      }
    }
  }
  visitNode(htmlAst)
}

export const findNode = (htmlAst, predicate) => {
  let nodeMatching = null
  visitNodes(htmlAst, (node) => {
    if (predicate(node)) {
      nodeMatching = node
      return "stop"
    }
    return null
  })
  return nodeMatching
}

export const findChildNode = (htmlNode, predicate) => {
  const { childNodes = [] } = htmlNode
  return childNodes.find(predicate)
}

export const findNodeByTagName = (htmlAst, tagName) => {
  return findNode(htmlAst, (node) => node.nodeName === tagName)
}

export const findNodeById = (htmlAst, id) => {
  return findNode(htmlAst, (node) => {
    const idAttribute = getAttributeByName(node, "id")
    return idAttribute && idAttribute.value === id
  })
}

export const findNodes = (htmlAst, predicate) => {
  const nodes = []
  visitNodes(htmlAst, (node) => {
    if (predicate(node)) {
      nodes.push(node)
    }
    return null
  })
  return nodes
}

export const findAllNodeByTagName = (htmlAst, tagName) => {
  return findNodes(htmlAst, (node) => node.nodeName === tagName)
}
