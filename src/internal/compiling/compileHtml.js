/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

import { createHash } from "crypto"
import { require } from "../require.js"
import { renderNamePattern } from "../renderNamePattern.js"

const parse5 = require("parse5")

export const parseHtmlString = (htmlString) => {
  const htmlAst = parse5.parse(htmlString, { sourceCodeLocationInfo: true })
  return htmlAst
}

export const stringifyHtmlAst = (htmlAst) => {
  const htmlString = parse5.serialize(htmlAst)
  return htmlString
}

export const getHtmlNodeAttributeValue = (htmlNode, attributeName) => {
  const attribute = getAttributeByName(htmlNode.attrs, attributeName)
  return attribute ? attribute.value : undefined
}

export const getHtmlNodeTextContent = (htmlNode) => {
  const firstChild = htmlNode.childNodes[0]
  return firstChild && firstChild.nodeName === "#text" ? firstChild.value : undefined
}

export const getHtmlNodeLocation = (htmlNode) => {
  const { sourceCodeLocation } = htmlNode
  if (!sourceCodeLocation) {
    return {}
  }
  const { startLine, startCol } = sourceCodeLocation
  return {
    line: startLine,
    column: startCol,
  }
}

const getAttributeByName = (attributes, attributeName) =>
  attributes.find((attr) => attr.name === attributeName)

export const htmlAstContains = (htmlAst, predicate) => {
  let contains = false
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      contains = true
      return "stop"
    }
    return null
  })
  return contains
}

export const htmlNodeIsScriptModule = (htmlNode) => {
  return htmlNode.nodeName === "script" && getHtmlNodeAttributeValue(htmlNode, "type") === "module"
}

// let's <img>, <link for favicon>, <link for css>, <styles>
// <audio> <video> <picture> supports comes for free by detecting
// <source src> attribute
// if srcset is used we should parse it and collect all src referenced in it
// also <link ref="preload">
// ideally relative iframe should recursively fetch (not needed so lets ignore)
// <svg> ideally looks for external ressources inside them

// but right now we will focus on: <link href> and <style> tags
// on veut vérifier qu'on les récupere bien
// dans rollup pour chaque css on feras le transformcss + l'ajout des assets reférencés
// pour le style inline on le parse aussi et on le remettra inline dans le html
// ensuite qu'on est capable de les mettre a jour
// ce qui veut dire de mettre a jour link.ref et style.text
export const parseHtmlAstRessources = (htmlAst) => {
  const scripts = []
  const stylesheetLinks = []
  const styles = []

  visitHtmlAst(htmlAst, (node) => {
    if (node.nodeName === "script") {
      scripts.push(node)
    }

    if (node.nodeName === "link" && getHtmlNodeAttributeValue(node, "rel") === "stylesheet") {
      stylesheetLinks.push(node)
    }

    if (node.nodeName === "style") {
      styles.push(node)
    }
  })

  return {
    scripts,
    stylesheetLinks,
    styles,
  }
}

export const replaceHtmlNode = (scriptNode, replacement, { inheritAttributes = true } = {}) => {
  let newScriptNode
  if (typeof replacement === "string") {
    newScriptNode = parseHtmlAsSingleElement(replacement)
  } else {
    newScriptNode = replacement
  }

  if (inheritAttributes) {
    newScriptNode.attrs = [
      // inherit script attributes except src, type, href
      ...scriptNode.attrs.filter(
        ({ name }) => name !== "type" && name !== "src" && name !== "href",
      ),
      ...newScriptNode.attrs,
    ]
  }

  replaceNode(scriptNode, newScriptNode)
}

export const manipulateHtmlAst = (htmlAst, { scriptInjections = [] }) => {
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
  const fragment = parse5.parseFragment(html)
  return fragment
}

const findExistingScript = (node, script) =>
  findChild(node, (childNode) => {
    return childNode.nodeName === "script" && sameScript(childNode, script)
  })

const findChild = ({ childNodes = [] }, predicate) => childNodes.find(predicate)

const sameScript = (node, { type = "text/javascript", src }) => {
  const nodeType = getHtmlNodeAttributeValue(node, "type") || "text/javascript"

  if (type === "importmap") {
    return nodeType === type
  }

  const nodeSrc = getHtmlNodeAttributeValue(node, "src")
  return nodeType === type && nodeSrc === src
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
  hash.update(getHtmlNodeTextContent(script))
  return hash.digest("hex").slice(0, 8)
}

export const getUniqueNameForInlineHtmlNode = (node, nodes, pattern) => {
  return renderNamePattern(pattern, {
    id: () => {
      const nodeId = getHtmlNodeAttributeValue(node, "id")
      if (nodeId) {
        return nodeId
      }

      const { line, column } = getHtmlNodeLocation(node)
      const lineTaken = nodes.some(
        (nodeCandidate) =>
          nodeCandidate !== node && getHtmlNodeLocation(nodeCandidate).line === line,
      )
      if (lineTaken) {
        return `${line}.${column}`
      }

      return line
    },
  })
}

const parseHtmlAsSingleElement = (html) => {
  const fragment = parse5.parseFragment(html)
  return fragment.childNodes[0]
}

const replaceNode = (node, newNode) => {
  const { parentNode } = node
  const parentNodeChildNodes = parentNode.childNodes
  const nodeIndex = parentNodeChildNodes.indexOf(node)
  parentNodeChildNodes[nodeIndex] = newNode
}

const visitHtmlAst = (htmlAst, callback) => {
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
