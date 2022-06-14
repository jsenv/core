/*
 * Update <link rel="preload"> and friends after build (once we know everything)
 *
 * - Used to remove ressource hint targeting an url that is no longer used:
 *   - Happens because of import assertions transpilation (file is inlined into JS)
 */

import {
  parseHtmlString,
  visitHtmlAst,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"

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
      const visitLinkWithHref = (linkNode, hrefAttribute) => {
        const href = hrefAttribute.value
        if (!href || href.startsWith("data:")) {
          return
        }
        const relAttribute = getHtmlNodeAttributeByName(linkNode, "rel")
        const rel = relAttribute ? relAttribute.value : undefined
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
          hrefAttribute.value = urlInfo.data.buildUrlSpecifier
        })
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
