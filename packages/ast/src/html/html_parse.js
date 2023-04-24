import { parse, serialize, parseFragment } from "parse5"

import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js"
import {
  storeHtmlNodePosition,
  storeHtmlNodeAttributePosition,
} from "./html_node_position.js"
import { findHtmlChildNode, visitHtmlNodes } from "./html_search.js"
import { getHtmlNodeText } from "./html_node_text.js"

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
        "*": (node) => {
          if (node.nodeName === "script" || node.nodeName === "style") {
            const htmlNodeText = getHtmlNodeText(node)
            if (htmlNodeText !== undefined) {
              storeHtmlNodePosition(node)
            }
          }
          storeHtmlNodeAttributePosition(node, "src")
          storeHtmlNodeAttributePosition(node, "href")
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
  { cleanupJsenvAttributes = false, cleanupPositionAttributes = false } = {},
) => {
  if (cleanupJsenvAttributes || cleanupPositionAttributes) {
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
            ...(cleanupJsenvAttributes
              ? {
                  "inlined-from-src": undefined,
                  "inlined-from-href": undefined,
                  "jsenv-cooked-by": undefined,
                  "jsenv-inlined-by": undefined,
                  "jsenv-injected-by": undefined,
                  "jsenv-debug": undefined,
                }
              : {}),
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
