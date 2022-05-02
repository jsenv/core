import { require } from "@jsenv/utils/require.js"

// https://github.com/inikulin/parse5/blob/master/packages/parse5/lib/tree-adapters/default.js
// eslint-disable-next-line import/no-unresolved
// const treeAdapter = require("parse5/lib/tree-adapters/default.js")

export const parseHtmlString = (
  htmlString,
  { storeOriginalPositions = true } = {},
) => {
  const parse5 = require("parse5")
  const htmlAst = parse5.parse(htmlString, { sourceCodeLocationInfo: true })
  if (storeOriginalPositions) {
    const htmlNode = findChild(htmlAst, (node) => node.nodeName === "html")
    const storedAttribute = getHtmlNodeAttributeByName(
      htmlNode,
      "original-position-stored",
    )
    if (!storedAttribute) {
      visitHtmlAst(htmlAst, (node) => {
        if (node.nodeName === "script" || node.nodeName === "style") {
          const textNode = getHtmlNodeTextNode(node)
          if (textNode) {
            htmlNodePosition.saveNodePosition(node)
            return
          }
        }
        htmlNodePosition.saveAttributePosition(node, "src")
        htmlNodePosition.saveAttributePosition(node, "href")
      })
      assignHtmlNodeAttributes(htmlNode, {
        "original-position-stored": "",
      })
    }
  }
  return htmlAst
}

export const htmlNodePosition = {
  saveNodePosition: (node) => {
    const originalPositionAttributeName = `original-position`
    const originalPositionAttribute = getHtmlNodeAttributeByName(
      node,
      originalPositionAttributeName,
    )
    if (originalPositionAttribute) {
      return true
    }
    const { sourceCodeLocation } = node
    if (!sourceCodeLocation) {
      return false
    }
    const { startLine, startCol, endLine, endCol } = sourceCodeLocation
    assignHtmlNodeAttributes(node, {
      [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
    })
    return true
  },

  readNodePosition: (node, { preferOriginal = false } = {}) => {
    const position = {}
    const { sourceCodeLocation } = node
    if (sourceCodeLocation) {
      const { startLine, startCol, endLine, endCol } = sourceCodeLocation
      Object.assign(position, {
        line: startLine,
        lineEnd: endLine,
        column: startCol,
        columnEnd: endCol,
      })
    }
    const originalPositionAttribute = getHtmlNodeAttributeByName(
      node,
      "original-position",
    )
    if (originalPositionAttribute) {
      const [start, end] = originalPositionAttribute.value.split(";")
      const [originalLine, originalColumn] = start.split(":")
      const [originalLineEnd, originalColumnEnd] = end.split(":")
      Object.assign(position, {
        originalLine: parseInt(originalLine),
        originalColumn: parseInt(originalColumn),
        originalLineEnd: parseInt(originalLineEnd),
        originalColumnEnd: parseInt(originalColumnEnd),
      })
      if (preferOriginal) {
        position.line = position.originalLine
        position.column = position.originalColumn
        position.lineEnd = position.originalLineEnd
        position.columnEnd = position.originalColumnEnd
        position.isOriginal = true
      }
    }
    return position
  },

  saveAttributePosition: (node, attributeName) => {
    const { sourceCodeLocation } = node
    if (!sourceCodeLocation) {
      return false
    }
    const attribute = getHtmlNodeAttributeByName(node, attributeName)
    if (!attribute) {
      return false
    }
    const attributeLocation = sourceCodeLocation.attrs[attributeName]
    if (!attributeLocation) {
      return false
    }
    const originalPositionAttributeName = `original-${attributeName}-position`
    const originalPositionAttribute = getHtmlNodeAttributeByName(
      node,
      originalPositionAttributeName,
    )
    if (originalPositionAttribute) {
      return true
    }
    const { startLine, startCol, endLine, endCol } = attributeLocation
    assignHtmlNodeAttributes(node, {
      [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
    })
    return true
  },

  readAttributePosition: (node, attributeName) => {
    const position = {}
    const { sourceCodeLocation } = node
    if (sourceCodeLocation) {
      const attributeLocation = sourceCodeLocation.attrs[attributeName]
      if (attributeLocation) {
        Object.assign(position, {
          line: attributeLocation.startLine,
          column: attributeLocation.startCol,
        })
      }
    }
    const originalPositionAttributeName =
      attributeName === "generated-from-src"
        ? "original-src-position"
        : attributeName === "generated-from-href"
        ? "original-href-position"
        : `original-${attributeName}-position`
    const originalPositionAttribute = getHtmlNodeAttributeByName(
      node,
      originalPositionAttributeName,
    )
    if (originalPositionAttribute) {
      const [start, end] = originalPositionAttribute.value.split(";")
      const [originalLine, originalColumn] = start.split(":")
      const [originalLineEnd, originalColumnEnd] = end.split(":")
      Object.assign(position, {
        originalLine: parseInt(originalLine),
        originalColumn: parseInt(originalColumn),
        originalLineEnd: parseInt(originalLineEnd),
        originalColumnEnd: parseInt(originalColumnEnd),
      })
    }
    return position
  },
}

export const stringifyHtmlAst = (
  htmlAst,
  { removeOriginalPositionAttributes = false } = {},
) => {
  const parse5 = require("parse5")
  if (removeOriginalPositionAttributes) {
    const htmlNode = findChild(htmlAst, (node) => node.nodeName === "html")
    const storedAttribute = getHtmlNodeAttributeByName(
      htmlNode,
      "original-position-stored",
    )
    if (storedAttribute) {
      removeHtmlNodeAttributeByName(htmlNode, "original-position-stored")
      visitHtmlAst(htmlAst, (node) => {
        removeHtmlNodeAttributeByName(node, "original-position")
        removeHtmlNodeAttributeByName(node, "original-src-position")
        removeHtmlNodeAttributeByName(node, "original-href-position")
        removeHtmlNodeAttributeByName(node, "injected-by")
        removeHtmlNodeAttributeByName(node, "generated-by")
        removeHtmlNodeAttributeByName(node, "generated-from-src")
        removeHtmlNodeAttributeByName(node, "generated-from-href")
      })
    }
  }
  const htmlString = parse5.serialize(htmlAst)

  return htmlString
}

export const parseSvgString = (svgString) => {
  const parse5 = require("parse5")
  const svgAst = parse5.parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  })
  return svgAst
}

export const findNode = (htmlAst, predicate) => {
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

export const setHtmlNodeGeneratedText = (
  node,
  {
    generatedText,
    generatedBy,
    generatedFromSrc,
    generatedFromHref,
    generatedFromInlineContent,
  } = {},
) => {
  setHtmlNodeText(node, generatedText)
  assignHtmlNodeAttributes(node, {
    "generated-by": generatedBy,
    ...(generatedFromSrc ? { "generated-from-src": generatedFromSrc } : {}),
    ...(generatedFromHref ? { "generated-from-href": generatedFromHref } : {}),
    ...(generatedFromInlineContent
      ? { "generated-from-inline-content": "" }
      : {}),
  })
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
  const injectedByAttribute = getHtmlNodeAttributeByName(
    scriptNode,
    "injected-by",
  )
  if (!injectedByAttribute) {
    assignHtmlNodeAttributes(scriptNode, { "injected-by": "jsenv" })
  }
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
  const futureIndex = futureNextSibling
    ? childNodes.indexOf(futureNextSibling)
    : 0
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex)
}

const insertAfter = (nodeToInsert, futureParentNode, futurePrevSibling) => {
  const { childNodes = [] } = futureParentNode
  const futureIndex = futurePrevSibling
    ? childNodes.indexOf(futurePrevSibling) + 1
    : childNodes.length
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex)
}

const injectWithWhitespaces = (nodeToInsert, futureParentNode, futureIndex) => {
  const { childNodes = [] } = futureParentNode
  const previousSiblings = childNodes.slice(0, futureIndex)
  const nextSiblings = childNodes.slice(futureIndex)
  const futureChildNodes = []
  const previousSibling = previousSiblings[0]
  if (previousSibling) {
    futureChildNodes.push(...previousSiblings)
  }
  if (!previousSibling || previousSibling.nodeName !== "#text") {
    futureChildNodes.push({
      nodeName: "#text",
      value: "\n    ",
      parentNode: futureParentNode,
    })
  }
  futureChildNodes.push(nodeToInsert)
  const nextSibling = nextSiblings[0]
  if (!nextSibling || nextSibling.nodeName !== "#text") {
    futureChildNodes.push({
      nodeName: "#text",
      value: "\n    ",
      parentNode: futureParentNode,
    })
  }
  if (nextSibling) {
    futureChildNodes.push(...nextSiblings)
  }
  futureParentNode.childNodes = futureChildNodes
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
