import { parse, serialize, parseFragment } from "parse5"

import {
  storeHtmlNodePosition,
  storeHtmlAttributePosition,
} from "./html_position.js"
import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js"
import { findHtmlChildNode, visitHtmlNodes } from "./html_search.js"
import { getHtmlNodeText } from "./html_text_node.js"

export const parseHtmlString = (
  htmlString,
  { storeOriginalPositions = true } = {},
) => {
  const htmlAst = parse(htmlString, { sourceCodeLocationInfo: true })
  if (storeOriginalPositions) {
    const htmlNode = findHtmlChildNode(
      htmlAst,
      (node) => node.nodeName === "html",
    )
    const stored = getHtmlNodeAttribute(htmlNode, "original-position-stored")
    if (stored === undefined) {
      visitHtmlNodes(htmlAst, {
        "script": (node) => {
          const htmlNodeText = getHtmlNodeText(node)
          if (htmlNodeText !== undefined) {
            storeHtmlNodePosition(node)
          }
        },
        "style": (node) => {
          const htmlNodeText = getHtmlNodeText(node)
          if (htmlNodeText !== undefined) {
            storeHtmlNodePosition(node)
          }
        },
        "*": (node) => {
          storeHtmlAttributePosition(node, "src")
          storeHtmlAttributePosition(node, "href")
        },
      })
      setHtmlNodeAttributes(htmlNode, {
        "original-position-stored": "",
      })
    }
  }
  return htmlAst
}

export const stringifyHtmlAst = (
  htmlAst,
  { removeOriginalPositionAttributes = false } = {},
) => {
  if (removeOriginalPositionAttributes) {
    const htmlNode = findHtmlChildNode(
      htmlAst,
      (node) => node.nodeName === "html",
    )
    const storedAttribute = getHtmlNodeAttribute(
      htmlNode,
      "original-position-stored",
    )
    if (storedAttribute !== undefined) {
      setHtmlNodeAttributes(htmlNode, {
        "original-position-stored": undefined,
      })
      visitHtmlNodes(htmlAst, {
        "*": (node) => {
          setHtmlNodeAttributes(node, {
            "original-position": undefined,
            "original-src-position": undefined,
            "original-href-position": undefined,
            "injected-by": undefined,
            "generated-by": undefined,
            "generated-from-src": undefined,
            "generated-from-href": undefined,
          })
        },
      })
    }
  }
  const htmlString = serialize(htmlAst)

  return htmlString
}

export const parseSvgString = (svgString) => {
  const svgAst = parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  })
  return svgAst
}
export const stringifySvgAst = stringifyHtmlAst
