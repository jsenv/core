/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

import { createHash } from "crypto"

import { require } from "../require.js"

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

export const findNodes = (htmlString, predicate) => {
  const htmlAst = parseHtmlString(htmlString)
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

export const removeHtmlNodeAttribute = (htmlNode, attributeToRemove) => {
  const attrIndex = htmlNode.attrs.indexOf(attributeToRemove)
  if (attrIndex === -1) {
    return false
  }
  htmlNode.attrs.splice(attrIndex, 1)
  return true
}

export const addHtmlNodeAttribute = (htmlNode, attributeToSet) => {
  if (typeof attributeToSet !== "object") {
    throw new TypeError(
      `addHtmlNodeAttribute attribute must be an object {name, value}`,
    )
  }

  const existingAttributeIndex = htmlNode.attrs.findIndex(
    (attr) => attr.name === attributeToSet.name,
  )
  if (existingAttributeIndex === -1) {
    htmlNode.attrs.push(attributeToSet)
  } else {
    htmlNode.attrs[existingAttributeIndex] = attributeToSet
  }
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
    const { startLine, startCol } = sourceCodeLocation
    return {
      line: startLine,
      column: startCol,
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

export const parseSrcset = (srcsetString) => {
  const srcsetParts = []
  srcsetString.split(",").forEach((set) => {
    const [specifier, descriptor] = set.trim().split(" ")
    srcsetParts.push({
      specifier,
      descriptor,
    })
  })
  return srcsetParts
}

export const stringifySrcset = (srcsetParts) => {
  const srcsetString = srcsetParts
    .map(({ specifier, descriptor }) => `${specifier} ${descriptor}`)
    .join(", ")
  return srcsetString
}

// <img>, <link for favicon>, <link for css>, <styles>
// <audio> <video> <picture> supports comes for free by detecting
// <source src> attribute
// ideally relative iframe should recursively fetch (not needed so lets ignore)
export const parseHtmlAstRessources = (htmlAst) => {
  const links = []
  const styles = []
  const scripts = []
  const imgs = []
  const images = []
  const uses = []
  const sources = []

  visitHtmlAst(htmlAst, (node) => {
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
    links,
    styles,
    scripts,
    imgs,
    images,
    uses,
    sources,
  }
}

export const collectHtmlDependenciesFromAst = (htmlAst) => {
  const { links, scripts, imgs, images, uses, sources } =
    parseHtmlAstRessources(htmlAst)

  const dependencies = []
  const visitSrcAttribute = (htmlNode) => {
    const srcAttribute = getHtmlNodeAttributeByName(htmlNode, "src")
    const src = srcAttribute ? srcAttribute.value : undefined
    if (src) {
      dependencies.push({
        htmlNode,
        attribute: srcAttribute,
        specifier: src,
      })
    }
  }
  const visitHrefAttribute = (htmlNode) => {
    const hrefAttribute = getHtmlNodeAttributeByName(htmlNode, "href")
    const href = hrefAttribute ? hrefAttribute.value : undefined
    if (href && href[0] !== "#") {
      dependencies.push({
        htmlNode,
        attribute: hrefAttribute,
        specifier: href,
      })
    }
  }
  const visitSrcSetAttribute = (htmlNode) => {
    const srcsetAttribute = getHtmlNodeAttributeByName(htmlNode, "srcset")
    if (srcsetAttribute) {
      const srcsetParts = parseSrcset(srcsetAttribute.value)
      srcsetParts.forEeach(({ specifier }) => {
        dependencies.push({
          htmlNode,
          attribute: srcsetAttribute,
          specifier,
        })
      })
    }
  }

  links.forEach((link) => {
    visitHrefAttribute(link)
  })
  scripts.forEach((script) => {
    visitSrcAttribute(script)
  })
  imgs.forEach((img) => {
    visitSrcAttribute(img)
    visitSrcSetAttribute(img)
  })
  sources.forEach((source) => {
    visitSrcAttribute(source)
    visitSrcSetAttribute(source)
  })
  // svg <image> tag
  images.forEach((image) => {
    visitHrefAttribute(image)
  })
  uses.forEach((use) => {
    visitHrefAttribute(use)
  })

  return dependencies
}

export const replaceHtmlNode = (
  node,
  replacement,
  { attributesInherit = true, attributesToIgnore = [] } = {},
) => {
  let newNode
  if (typeof replacement === "string") {
    newNode = parseHtmlAsSingleElement(replacement)
  } else {
    newNode = replacement
  }

  if (attributesInherit) {
    const attributeMap = {}
    // inherit attributes except thoos listed in attributesToIgnore
    node.attrs.forEach((attribute) => {
      if (attributesToIgnore.includes(attribute.name)) {
        return
      }
      attributeMap[attribute.name] = attribute
    })
    newNode.attrs.forEach((newAttribute) => {
      attributeMap[newAttribute.name] = newAttribute
    })
    const attributes = []
    Object.keys(attributeMap).forEach((attributeName) => {
      attributes.push(attributeMap[attributeName])
    })
    newNode.attrs = attributes
  }

  replaceNode(node, newNode)
}

export const manipulateHtmlAst = (htmlAst, { scriptInjections = [] }) => {
  if (scriptInjections.length === 0) {
    return
  }

  const htmlNode = htmlAst.childNodes.find((node) => node.nodeName === "html")
  const headNode = htmlNode.childNodes[0]
  const bodyNode = htmlNode.childNodes[1]

  const scriptsToPreprendInHead = []
  scriptInjections.forEach((script) => {
    const scriptExistingInHead = findExistingScript(headNode, script)
    if (scriptExistingInHead) {
      replaceNode(scriptExistingInHead, scriptToNode(script))
      return
    }
    const scriptExistingInBody = findExistingScript(bodyNode, script)
    if (scriptExistingInBody) {
      replaceNode(scriptExistingInBody, scriptToNode(script))
      return
    }
    scriptsToPreprendInHead.push(script)
  })
  const headScriptsFragment = scriptsToFragment(scriptsToPreprendInHead)
  insertFragmentBefore(
    headNode,
    headScriptsFragment,
    findChild(headNode, (node) => node.nodeName === "script"),
  )
}

const insertFragmentBefore = (node, fragment, childNode) => {
  const { childNodes = [] } = node

  if (childNode) {
    const childNodeIndex = childNodes.indexOf(childNode)
    node.childNodes = [
      ...childNodes.slice(0, childNodeIndex),
      ...fragment.childNodes.map((child) => {
        return { ...child, parentNode: node }
      }),
      ...childNodes.slice(childNodeIndex),
    ]
  } else {
    node.childNodes = [
      ...childNodes,
      ...fragment.childNodes.map((child) => {
        return { ...child, parentNode: node }
      }),
    ]
  }
}

const scriptToNode = (script) => {
  return scriptsToFragment([script]).childNodes[0]
}

const scriptsToFragment = (scripts) => {
  const html = scripts.reduce((previous, script) => {
    const { text = "", ...attributes } = script
    const scriptAttributes = objectToHtmlAttributes(attributes)
    return `${previous}<script ${scriptAttributes}>${text}</script>
      `
  }, "")
  const parse5 = require("parse5")
  const fragment = parse5.parseFragment(html)
  return fragment
}

const findExistingScript = (node, script) =>
  findChild(node, (childNode) => {
    return childNode.nodeName === "script" && sameScript(childNode, script)
  })

const findChild = ({ childNodes = [] }, predicate) => childNodes.find(predicate)

const sameScript = (node, { type = "text/javascript", src }) => {
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  const leftScriptType = typeAttribute ? typeAttribute.value : "text/javascript"
  if (leftScriptType !== type) {
    return false
  }

  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute && src) {
    return false
  }
  if (srcAttribute && srcAttribute.value !== src) {
    return false
  }

  return true
}

const objectToHtmlAttributes = (object) => {
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

export const getUniqueNameForInlineHtmlNode = (node, nodes, pattern) => {
  return renderNamePattern(pattern, {
    id: () => {
      const idAttribute = getHtmlNodeAttributeByName(node, "id")
      if (idAttribute) {
        return idAttribute.value
      }

      const { line, column } = getHtmlNodeLocation(node) || {}
      const lineTaken = nodes.some((nodeCandidate) => {
        if (nodeCandidate === node) return false
        const htmlNodeLocation = getHtmlNodeLocation(nodeCandidate)
        if (!htmlNodeLocation) return false
        return htmlNodeLocation.line === line
      })
      if (lineTaken) {
        return `${line}.${column}`
      }

      return line
    },
  })
}

const renderNamePattern = (pattern, replacements) => {
  return pattern.replace(/\[(\w+)\]/g, (_match, type) => {
    const replacement = replacements[type]()
    return replacement
  })
}

const parseHtmlAsSingleElement = (html) => {
  const parse5 = require("parse5")
  const fragment = parse5.parseFragment(html)
  return fragment.childNodes[0]
}

const replaceNode = (node, newNode) => {
  const { parentNode } = node
  const parentNodeChildNodes = parentNode.childNodes
  const nodeIndex = parentNodeChildNodes.indexOf(node)
  parentNodeChildNodes[nodeIndex] = newNode
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
