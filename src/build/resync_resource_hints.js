/*
 * Update <link rel="preload"> and friends after build (once we know everything)
 *
 * - Used to remove resource hint targeting an url that is no longer used:
 *   - Happens because of import assertions transpilation (file is inlined into JS)
 */

import {
  parseHtmlString,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  removeHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/ast"

import { GRAPH } from "./graph_utils.js"

export const resyncResourceHints = async ({
  logger,
  finalGraphKitchen,
  finalGraph,
  buildUrls,
}) => {
  const actions = []
  GRAPH.forEach(finalGraph, (urlInfo) => {
    if (urlInfo.type !== "html") {
      return
    }
    actions.push(async () => {
      const htmlAst = parseHtmlString(urlInfo.content, {
        storeOriginalPositions: false,
      })
      const mutations = []
      visitHtmlNodes(htmlAst, {
        link: (node) => {
          const href = getHtmlNodeAttribute(node, "href")
          if (href === undefined || href.startsWith("data:")) {
            return
          }
          const rel = getHtmlNodeAttribute(node, "rel")
          const isresourceHint = [
            "preconnect",
            "dns-prefetch",
            "prefetch",
            "preload",
            "modulepreload",
          ].includes(rel)
          if (!isresourceHint) {
            return
          }
          const buildUrl = buildUrls[href]
          const buildUrlInfo = finalGraph.getUrlInfo(buildUrl)
          if (!buildUrlInfo) {
            logger.warn(
              `remove resource hint because cannot find "${href}" in the graph`,
            )
            mutations.push(() => {
              removeHtmlNode(node)
            })
            return
          }
          if (buildUrlInfo.dependents.size === 0) {
            logger.info(
              `remove resource hint because "${href}" not used anymore`,
            )
            mutations.push(() => {
              removeHtmlNode(node)
            })
            return
          }
        },
      })
      if (mutations.length > 0) {
        mutations.forEach((mutation) => mutation())
        await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
          urlInfo,
          {
            content: stringifyHtmlAst(htmlAst),
          },
        )
      }
    })
  })
  await Promise.all(actions.map((resourceHintAction) => resourceHintAction()))
}
