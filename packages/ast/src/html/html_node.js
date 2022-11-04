import { parseFragment } from "parse5"

import { setHtmlNodeAttributes } from "./html_node_attributes.js"
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

export const injectHtmlNode = (htmlAst, node, jsenvPluginName = "jsenv") => {
  setHtmlNodeAttributes(node, {
    "jsenv-plugin-owner": jsenvPluginName,
    "jsenv-plugin-action": "injected",
  })
  const htmlHtmlNode = findChild(htmlAst, (node) => node.nodeName === "html")
  const bodyNode = findChild(htmlHtmlNode, (node) => node.nodeName === "body")
  return insertHtmlNodeAfter(node, bodyNode)
}

export const injectScriptNodeAsEarlyAsPossible = (
  htmlAst,
  scriptNode,
  jsenvPluginName = "jsenv",
) => {
  setHtmlNodeAttributes(scriptNode, {
    "jsenv-plugin-owner": jsenvPluginName,
    "jsenv-plugin-action": "injected",
  })
  const isJsModule = analyzeScriptNode(scriptNode).type === "js_module"
  if (isJsModule) {
    const firstImportmapScript = findHtmlNode(htmlAst, (node) => {
      return (
        node.nodeName === "script" &&
        analyzeScriptNode(node).type === "importmap"
      )
    })

    if (firstImportmapScript) {
      const importmapParent = firstImportmapScript.parentNode
      const importmapSiblings = importmapParent.childNodes
      const nextSiblings = importmapSiblings.slice(
        importmapSiblings.indexOf(firstImportmapScript) + 1,
      )
      let after = firstImportmapScript
      for (const nextSibling of nextSiblings) {
        if (nextSibling.nodeName === "script") {
          return insertHtmlNodeBefore(scriptNode, importmapParent, nextSibling)
        }
        if (nextSibling.nodeName === "link") {
          after = nextSibling
        }
      }
      return insertHtmlNodeAfter(scriptNode, importmapParent, after)
    }
  }
  const headNode = findChild(htmlAst, (node) => node.nodeName === "html")
    .childNodes[0]
  let after = headNode.childNodes[0]
  for (const child of headNode.childNodes) {
    if (child.nodeName === "script") {
      return insertHtmlNodeBefore(scriptNode, headNode, child)
    }
    if (child.nodeName === "link") {
      after = child
    }
  }
  return insertHtmlNodeAfter(scriptNode, headNode, after)
}

export const insertHtmlNodeBefore = (
  nodeToInsert,
  futureParentNode,
  futureNextSibling,
) => {
  const { childNodes = [] } = futureParentNode
  const futureIndex = futureNextSibling
    ? childNodes.indexOf(futureNextSibling)
    : 0
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex)
}

export const insertHtmlNodeAfter = (
  nodeToInsert,
  futureParentNode,
  futurePrevSibling,
) => {
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
  let string = ""
  Object.keys(object).forEach((key) => {
    const value = object[key]
    if (value === undefined) return
    if (string !== "") string += " "
    string += `${key}=${valueToHtmlAttributeValue(value)}`
  })
  return string
}

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
}
