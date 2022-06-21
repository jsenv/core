/*
 * Update <link rel="preload"> and friends after build (once we know everything)
 *
 * - Used to remove ressource hint targeting an url that is no longer used:
 *   - Happens because of import assertions transpilation (file is inlined into JS)
 */

import {
  parseHtmlString,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  removeHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/ast"

import { GRAPH } from "./graph_utils.js"

export const resyncRessourceHints = async ({
  logger,
  finalGraphKitchen,
  finalGraph,
  rawUrls,
  postBuildRedirections,
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
      const actions = []
      const visitLinkWithHref = (linkNode, href) => {
        if (!href || href.startsWith("data:")) {
          return
        }
        const rel = getHtmlNodeAttribute(linkNode, "rel")
        const isRessourceHint = [
          "preconnect",
          "dns-prefetch",
          "prefetch",
          "preload",
          "modulepreload",
        ].includes(rel)
        if (!isRessourceHint) {
          return
        }

        let buildUrl
        for (const key of Object.keys(rawUrls)) {
          if (rawUrls[key] === href) {
            buildUrl = key
            break
          }
        }
        if (!buildUrl) {
          logger.warn(`remove ressource hint because cannot find "${href}"`)
          actions.push(() => {
            removeHtmlNode(linkNode)
          })
          return
        }
        buildUrl = postBuildRedirections[buildUrl] || buildUrl
        const urlInfo = finalGraph.getUrlInfo(buildUrl)
        if (!urlInfo) {
          logger.warn(
            `remove ressource hint because cannot find "${buildUrl}" in the graph`,
          )
          actions.push(() => {
            removeHtmlNode(linkNode)
          })
          return
        }
        if (urlInfo.dependents.size === 0) {
          logger.info(
            `remove ressource hint because "${href}" not used anymore`,
          )
          actions.push(() => {
            removeHtmlNode(linkNode)
          })
          return
        }
        actions.push(() => {
          setHtmlNodeAttributes(linkNode, {
            href: urlInfo.data.buildUrlSpecifier,
          })
        })
      }
      visitHtmlNodes(htmlAst, {
        link: (node) => {
          const href = getHtmlNodeAttribute(node, "href")
          if (href !== undefined) {
            visitLinkWithHref(node, href)
          }
        },
      })
      if (actions.length) {
        actions.forEach((action) => action())
        await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
          urlInfo,
          {
            content: stringifyHtmlAst(htmlAst),
          },
        )
      }
    })
  })
  await Promise.all(
    ressourceHintActions.map((ressourceHintAction) => ressourceHintAction()),
  )
}
