import { parseFragment } from "parse5"

import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js"
import { findHtmlNode } from "./html_search.js"
import { analyzeScriptNode } from "./html_analysis.js"

export const removeHtmlNode = (htmlNode) => {
  const { childNodes } = htmlNode.parentNode
  childNodes.splice(childNodes.indexOf(htmlNode), 1)
}

export const createHtmlNode = ({ tagName, textContent = "", ...rest }) => {
  const html = `<${tagName} ${stringifyAttributes(
    rest,
  )}>${textContent}</${tagName}>`
  const fragment = parseFragment(html)
  return fragment.childNodes[0]
}

export const injectScriptNodeAsEarlyAsPossible = (htmlAst, scriptNode) => {
  const injectedBy = getHtmlNodeAttribute(scriptNode, "injected-by")
  if (injectedBy === undefined) {
    setHtmlNodeAttributes(scriptNode, {
      "injected-by": "jsenv",
    })
  }
  const isJsModule = analyzeScriptNode(scriptNode).type === "js_module"
  if (isJsModule) {
    const firstImportmapScript = findHtmlNode(htmlAst, (node) => {
      if (node.nodeName !== "script") return false
      return analyzeScriptNode(node).type === "importmap"
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
