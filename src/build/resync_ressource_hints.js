import {
  parseHtmlString,
  visitHtmlAst,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"

import { GRAPH } from "./graph_utils.js"

// update ressource hint that where targeting a file that has changed during build
// (happens for import assertions and file modified by "?as_js_classic")
export const resyncRessourceHints = async ({
  finalGraphKitchen,
  finalGraph,
  buildUrls,
}) => {
  const ressourceHintActions = []
  GRAPH.forEach(finalGraph, (urlInfo) => {
    if (urlInfo.type !== "html") {
      return
    }
    ressourceHintActions.push(async () => {
      const htmlAst = parseHtmlString(urlInfo.content, {
        storeOriginalPositions: false,
      })
      const visitLinkWithHref = (linkNode, hrefAttribute) => {
        const href = hrefAttribute.value
        if (!href || href.startsWith("data:")) {
          return
        }
        const buildUrl = buildUrls[href]
        const urlInfo = finalGraph.getUrlInfo(buildUrl)
        if (!urlInfo) {
          return
        }
        if (urlInfo.dependents.size === 0) {
          console.warn("Remove non unused preload link")
          removeHtmlNode(linkNode)
          return
        }
      }
      visitHtmlAst(htmlAst, (node) => {
        if (node.nodeName !== "link") {
          return
        }
        const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
        if (!hrefAttribute) {
          return
        }
        visitLinkWithHref(node, hrefAttribute)
      })
      await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
        urlInfo,
        {
          content: stringifyHtmlAst(htmlAst),
        },
      )
    })
  })
  await Promise.all(
    ressourceHintActions.map((ressourceHintAction) => ressourceHintAction()),
  )
}
