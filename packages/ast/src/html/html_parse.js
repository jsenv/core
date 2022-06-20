import { parse, serialize, parseFragment } from "parse5"

import { storeNodePosition, storeAttributePosition } from "./html_position.js"
import {
  getAttributeByName,
  removeAttributeByName,
  setAttributes,
} from "./html_attributes.js"
import { findChildNode, visitNodes } from "./html_search.js"
import { getTextNode } from "./html_text_node.js"

export const parseString = (
  htmlString,
  { storeOriginalPositions = true } = {},
) => {
  const htmlAst = parse(htmlString, { sourceCodeLocationInfo: true })
  if (storeOriginalPositions) {
    const htmlNode = findChildNode(htmlAst, (node) => node.nodeName === "html")
    const storedAttribute = getAttributeByName(
      htmlNode,
      "original-position-stored",
    )
    if (!storedAttribute) {
      visitNodes(htmlAst, (node) => {
        if (node.nodeName === "script" || node.nodeName === "style") {
          const textNode = getTextNode(node)
          if (textNode) {
            storeNodePosition(node)
            return
          }
        }
        storeAttributePosition(node, "src")
        storeAttributePosition(node, "href")
      })
      setAttributes(htmlNode, {
        "original-position-stored": "",
      })
    }
  }
  return htmlAst
}

export const parseSvgString = (svgString) => {
  const svgAst = parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  })
  return svgAst
}

export const stringifyAst = (
  htmlAst,
  { removeOriginalPositionAttributes = false } = {},
) => {
  if (removeOriginalPositionAttributes) {
    const htmlNode = findChildNode(htmlAst, (node) => node.nodeName === "html")
    const storedAttribute = getAttributeByName(
      htmlNode,
      "original-position-stored",
    )
    if (storedAttribute) {
      removeAttributeByName(htmlNode, "original-position-stored")
      visitNodes(htmlAst, (node) => {
        removeAttributeByName(node, "original-position")
        removeAttributeByName(node, "original-src-position")
        removeAttributeByName(node, "original-href-position")
        removeAttributeByName(node, "injected-by")
        removeAttributeByName(node, "generated-by")
        removeAttributeByName(node, "generated-from-src")
        removeAttributeByName(node, "generated-from-href")
      })
    }
  }
  const htmlString = serialize(htmlAst)

  return htmlString
}
