/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

import { createHash } from "crypto"
import { require } from "../require.js"

const parse5 = require("parse5")

export const parseHtmlString = (htmlString) => {
  const htmlAst = parse5.parse(htmlString, { sourceCodeLocationInfo: true })
  return htmlAst
}

export const stringifyHtmlAst = (htmlAst) => {
  const htmlString = parse5.serialize(htmlAst)
  return htmlString
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
      const attributes = attributeArrayToAttributeObject(node.attrs)
      const firstChild = node.childNodes[0]
      scripts.push({
        node,
        attributes,
        ...(firstChild && firstChild.nodeName === "#text" ? { text: firstChild.value } : {}),
      })
    }

    if (node.nodeName === "link") {
      const attributes = attributeArrayToAttributeObject(node.attrs)
      if (attributes.rel === "stylesheet") {
        stylesheetLinks.push({
          node,
          attributes,
        })
      }
    }

    if (node.nodeName === "style") {
      const attributes = attributeArrayToAttributeObject(node.attrs)
      const firstChild = node.childNodes[0]
      styles.push({
        node,
        attributes,
        ...(firstChild && firstChild.nodeName === "#text" ? { text: firstChild.value } : {}),
      })
    }
  })

  return {
    scripts,
    stylesheetLinks,
    styles,
  }
}

const attributeArrayToAttributeObject = (attributes) => {
  const attributeObject = {}
  attributes.forEach((attribute) => {
    attributeObject[attribute.name] = attribute.value
  })
  return attributeObject
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
    const scriptAttributes = objectToHtmlAttributes(script)
    return `${previous}<script ${scriptAttributes}>${script.text || ""}</script>
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
  const nodeType = getAttributeValue(node, "type") || "text/javascript"
  const nodeSrc = getAttributeValue(node, "src")

  if (type === "importmap") {
    return nodeType === type
  }

  return nodeType === type && nodeSrc === src
}

// eslint-disable-next-line no-unused-vars
const objectToHtmlAttributes = ({ text, ...rest }) => {
  return Object.keys(rest)
    .map((key) => `${key}=${valueToHtmlAttributeValue(rest[key])}`)
    .join(" ")
}

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
}

const getAttributeValue = (node, attributeName) => {
  const attribute = getAttributeByName(node.attrs, attributeName)
  return attribute ? attribute.value : undefined
}

const getAttributeByName = (attributes, attributeName) =>
  attributes.find((attr) => attr.name === attributeName)

export const createInlineScriptHash = (script) => {
  const hash = createHash("sha256")
  hash.update(script.text)
  return hash.digest("hex").slice(0, 8)
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

const visitHtmlAst = (htmlAst, fn) => {
  const visitNode = (node) => {
    fn(node)
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
