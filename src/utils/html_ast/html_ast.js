import { createHash } from "node:crypto"

import { require } from "@jsenv/core/src/utils/require.js"

// https://github.com/inikulin/parse5/blob/master/packages/parse5/lib/tree-adapters/default.js
// eslint-disable-next-line import/no-unresolved
// const treeAdapter = require("parse5/lib/tree-adapters/default.js")

export const parseHtmlString = (htmlString) => {
  const parse5 = require("parse5")
  const htmlAst = parse5.parse(htmlString, { sourceCodeLocationInfo: true })
  return htmlAst
}

export const parseSvgString = (svgString) => {
  const parse5 = require("parse5")
  const svgAst = parse5.parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  })
  return svgAst
}

export const stringifyHtmlAst = (htmlAst) => {
  const parse5 = require("parse5")
  const htmlString = parse5.serialize(htmlAst)
  return htmlString
}

export const findNode = (htmlStringOrAst, predicate) => {
  const htmlAst =
    typeof htmlStringOrAst === "string"
      ? parseHtmlString(htmlStringOrAst)
      : htmlStringOrAst
  let nodeMatching = null
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      nodeMatching = node
      return "stop"
    }
    return null
  })
  return nodeMatching
}

export const findNodes = (htmlStringOrAst, predicate) => {
  const htmlAst =
    typeof htmlStringOrAst === "string"
      ? parseHtmlString(htmlStringOrAst)
      : htmlStringOrAst
  const nodes = []
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      nodes.push(node)
    }
    return null
  })
  return nodes
}

export const findNodeByTagName = (htmlString, tagName) =>
  findNode(htmlString, (node) => node.nodeName === tagName)

export const findHtmlNodeById = (htmlString, id) => {
  return findNode(htmlString, (node) => {
    const idAttribute = getHtmlNodeAttributeByName(node, "id")
    return idAttribute && idAttribute.value === id
  })
}

export const findAllNodeByTagName = (htmlString, tagName) =>
  findNodes(htmlString, (node) => node.nodeName === tagName)

export const findFirstImportMapNode = (htmlStringOrAst) =>
  findNode(htmlStringOrAst, htmlNodeIsScriptImportmap)

export const getHtmlNodeAttributeByName = (htmlNode, attributeName) => {
  const attrs = htmlNode.attrs
  return attrs && attrs.find((attr) => attr.name === attributeName)
}

export const removeHtmlNodeAttributeByName = (htmlNode, attributeName) => {
  const attr = getHtmlNodeAttributeByName(htmlNode, attributeName)
  return attr ? removeHtmlNodeAttribute(htmlNode, attr) : false
}

export const removeHtmlNodeAttribute = (htmlNode, attributeToRemove) => {
  const attrIndex = htmlNode.attrs.indexOf(attributeToRemove)
  if (attrIndex === -1) {
    return false
  }
  htmlNode.attrs.splice(attrIndex, 1)
  return true
}

export const assignHtmlNodeAttributes = (htmlNode, attributesToAssign) => {
  if (typeof attributesToAssign !== "object") {
    throw new TypeError(`assignHtmlNodeAttributes second arg must be an object`)
  }
  Object.keys(attributesToAssign).forEach((key) => {
    const existingAttributeIndex = htmlNode.attrs.findIndex(
      ({ name }) => name === key,
    )
    const value = attributesToAssign[key]
    if (existingAttributeIndex === -1) {
      htmlNode.attrs.push({
        name: key,
        value,
      })
    } else {
      htmlNode.attrs[existingAttributeIndex].value = value
    }
  })
}

export const getHtmlNodeTextNode = (htmlNode) => {
  const firstChild = htmlNode.childNodes[0]
  return firstChild && firstChild.nodeName === "#text" ? firstChild : null
}

export const setHtmlNodeText = (htmlNode, textContent) => {
  const textNode = getHtmlNodeTextNode(htmlNode)
  if (textNode) {
    textNode.value = textContent
  } else {
    const newTextNode = {
      nodeName: "#text",
      value: textContent,
      parentNode: htmlNode,
    }
    htmlNode.childNodes.splice(0, 0, newTextNode)
  }
}

export const removeHtmlNodeText = (htmlNode) => {
  const textNode = getHtmlNodeTextNode(htmlNode)
  if (textNode) {
    htmlNode.childNodes = []
  }
}

export const removeHtmlNode = (htmlNode) => {
  const { childNodes } = htmlNode.parentNode
  childNodes.splice(childNodes.indexOf(htmlNode), 1)
}

export const getHtmlNodeLocation = (htmlNode, htmlAttributeName) => {
  const { sourceCodeLocation } = htmlNode
  if (!sourceCodeLocation) {
    return null
  }

  if (!htmlAttributeName) {
    const { startLine, endLine, startCol, endCol } = sourceCodeLocation
    return {
      line: startLine,
      lineEnd: endLine,
      column: startCol,
      columnEnd: endCol,
    }
  }

  const attributeSourceCodeLocation =
    sourceCodeLocation.attrs[htmlAttributeName]
  if (!attributeSourceCodeLocation) {
    return null
  }
  const { startLine, startCol } = attributeSourceCodeLocation
  return {
    line: startLine,
    column: startCol,
  }
}

export const findHtmlNode = (htmlAst, predicate) => {
  let nodeFound = null
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      nodeFound = node
      return "stop"
    }
    return null
  })
  return nodeFound
}

export const htmlNodeIsScriptModule = (htmlNode) => {
  if (htmlNode.nodeName !== "script") {
    return false
  }
  const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type")
  if (!typeAttribute) {
    return false
  }
  return typeAttribute.value === "module"
}

export const htmlNodeIsScriptImportmap = (htmlNode) => {
  if (htmlNode.nodeName !== "script") {
    return false
  }
  const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type")
  if (!typeAttribute) {
    return false
  }
  return typeAttribute.value === "importmap"
}

// <img>, <link for favicon>, <link for css>, <styles>
// <audio> <video> <picture> supports comes for free by detecting
// <source src> attribute
// ideally relative iframe should recursively fetch (not needed so lets ignore)
export const parseHtmlAstRessources = (htmlAst) => {
  const aNodes = []
  const links = []
  const styles = []
  const scripts = []
  const imgs = []
  const images = []
  const uses = []
  const sources = []
  visitHtmlAst(htmlAst, (node) => {
    if (node.nodeName === "a") {
      aNodes.push(node)
      return
    }
    if (node.nodeName === "link") {
      links.push(node)
      return
    }
    if (node.nodeName === "style") {
      styles.push(node)
      return
    }
    if (node.nodeName === "script") {
      scripts.push(node)
      return
    }
    if (node.nodeName === "img") {
      imgs.push(node)
      return
    }
    if (node.nodeName === "image") {
      images.push(node)
      return
    }
    if (node.nodeName === "use") {
      uses.push(node)
      return
    }
    if (node.nodeName === "source") {
      sources.push(node)
      return
    }
  })

  return {
    aNodes,
    links,
    styles,
    scripts,
    imgs,
    images,
    uses,
    sources,
  }
}

export const parseLinkNode = (linkNode) => {
  const relAttr = getHtmlNodeAttributeByName(linkNode, "rel")
  const rel = relAttr ? relAttr.value : undefined

  if (rel === "stylesheet") {
    return {
      isStylesheet: true,
    }
  }
  const isRessourceHint = [
    "preconnect",
    "dns-prefetch",
    "prefetch",
    "preload",
    "modulepreload",
  ].includes(rel)
  return {
    isRessourceHint,
    rel,
  }
}

export const parseScriptNode = (scriptNode) => {
  const typeAttribute = getHtmlNodeAttributeByName(scriptNode, "type")
  if (!typeAttribute) {
    return "classic"
  }
  if (
    typeAttribute.value === "text/javascript" ||
    typeAttribute.value === "application/javascript"
  ) {
    return "classic"
  }
  if (typeAttribute.value === "module") {
    return "module"
  }
  if (typeAttribute.value === "importmap") {
    return "importmap"
  }
  return typeAttribute.value
}

export const createHtmlNode = ({ tagName, textContent = "", ...rest }) => {
  const html = `<${tagName} ${stringifyAttributes(
    rest,
  )}>${textContent}</${tagName}>`
  const parse5 = require("parse5")
  const fragment = parse5.parseFragment(html)
  return fragment.childNodes[0]
}

export const injectScriptAsEarlyAsPossible = (htmlAst, scriptNode) => {
  const isModule = parseScriptNode(scriptNode) === "module"
  if (isModule) {
    const firstImportmapScript = findHtmlNode(htmlAst, (node) => {
      if (node.nodeName !== "script") return false
      return parseScriptNode(node) === "importmap"
    })
    if (firstImportmapScript) {
      return insertAfter(
        scriptNode,
        firstImportmapScript.parentNode,
        firstImportmapScript,
      )
    }
  }
  const headNode = findChild(htmlAst, (node) => node.nodeName === "html")
    .childNodes[0]
  const firstHeadScript = findChild(headNode, (node) => {
    return node.nodeName === "script"
  })
  return insertBefore(scriptNode, headNode, firstHeadScript)
}

const insertBefore = (nodeToInsert, futureParentNode, futureNextSibling) => {
  const { childNodes = [] } = futureParentNode
  if (futureNextSibling) {
    const nextSiblingIndex = childNodes.indexOf(futureNextSibling)
    futureParentNode.childNodes = [
      ...childNodes.slice(0, nextSiblingIndex),
      { ...nodeToInsert, parentNode: futureParentNode },
      ...childNodes.slice(nextSiblingIndex),
    ]
  } else {
    futureParentNode.childNodes = [
      ...childNodes,
      { ...nodeToInsert, parentNode: futureParentNode },
    ]
  }
}

const insertAfter = (nodeToInsert, futureParentNode, futurePrevSibling) => {
  const { childNodes = [] } = futureParentNode
  if (futurePrevSibling) {
    const nextSiblingIndex = childNodes.indexOf(futurePrevSibling)
    futureParentNode.childNodes = [
      ...childNodes.slice(0, nextSiblingIndex + 1),
      { ...nodeToInsert, parentNode: futureParentNode },
      ...childNodes.slice(nextSiblingIndex + 1),
    ]
  } else {
    futureParentNode.childNodes = [
      ...childNodes,
      { ...nodeToInsert, parentNode: futureParentNode },
    ]
  }
}

const findChild = ({ childNodes = [] }, predicate) => childNodes.find(predicate)

const stringifyAttributes = (object) => {
  return Object.keys(object)
    .map((key) => `${key}=${valueToHtmlAttributeValue(object[key])}`)
    .join(" ")
}

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
}

export const createInlineScriptHash = (script) => {
  const hash = createHash("sha256")
  hash.update(getHtmlNodeTextNode(script).value)
  return hash.digest("hex").slice(0, 8)
}

export const getIdForInlineHtmlNode = (htmlAst, inlineNode) => {
  // const idAttribute = getHtmlNodeAttributeByName(inlineNode, "id")
  // if (idAttribute) {
  //   return idAttribute.value
  // }
  const { line, lineEnd, column, columnEnd } =
    getHtmlNodeLocation(inlineNode) || {}
  const lineTaken = findNode(htmlAst, (nodeCandidate) => {
    if (nodeCandidate === inlineNode) return false
    if (
      nodeCandidate.nodeName === "#text" &&
      nodeCandidate.parentNode === inlineNode
    )
      return false
    const htmlNodeLocation = getHtmlNodeLocation(nodeCandidate)
    if (!htmlNodeLocation) return false
    return htmlNodeLocation.line === line
  })
  if (lineTaken) {
    return `L${line}C${column}-L${line}C${columnEnd}`
  }
  return `L${line}-L${lineEnd}`
}

export const visitHtmlAst = (htmlAst, callback) => {
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
