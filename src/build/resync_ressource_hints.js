import {
  parseHtmlString,
  visitHtmlAst,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
} from "@jsenv/utils/html_ast/html_ast.js"

import { GRAPH } from "./graph_utils.js"

// update ressource hint that where targeting a file that has changed during build
// (happens for import assertions and file modified by "?as_js_classic")
export const resyncRessourceHints = async ({
  finalGraphKitchen,
  finalGraph,
  rawUrls,
  buildUrls,
}) => {
  const ressourceHintActions = []
  GRAPH.forEach(finalGraph, (urlInfo) => {
    if (urlInfo.type !== "html") {
      return
    }
    const replacements = {}
    urlInfo.references.forEach((reference) => {
      if (!reference.isRessourceHint) {
        return
      }
      const referencedUrlInfo = finalGraph.getUrlInfo(reference.url)
      const updatedTo = referencedUrlInfo.data.updatedTo

      if (referencedUrlInfo.dependents.size === 0) {
        // when url is referenced solely by a <link />, if it was updated
        // then update the [href]
        if (updatedTo) {
          const buildUrl = Object.keys(rawUrls).find((buildUrl) => {
            return rawUrls[buildUrl] === updatedTo.url
          })
          if (!buildUrl) {
            return
          }
          const buildRelativeUrl = Object.keys(buildUrls).find(
            (key) => buildUrls[key] === buildUrl,
          )
          replacements[reference.generatedSpecifier] = buildRelativeUrl
        }
      }
    })
    if (Object.keys(replacements).length === 0) {
      return
    }
    ressourceHintActions.push(async () => {
      const htmlAst = parseHtmlString(urlInfo.content, {
        storeOriginalPositions: false,
      })
      visitHtmlAst(htmlAst, (node) => {
        if (node.nodeName !== "link") {
          return
        }
        const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
        if (!hrefAttribute) {
          return
        }
        const replacement = replacements[hrefAttribute.value]
        if (!replacement) {
          return
        }
        hrefAttribute.value = replacement
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
