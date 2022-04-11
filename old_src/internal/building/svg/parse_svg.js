import {
  parseSvgString,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
  getHtmlNodeLocation,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

import { getRessourceAsBase64Url } from "../ressource_builder_util.js"
import { collectHtmlMutations } from "../html/html_node_mutations.js"
import { minifyHtml } from "../html/minify_html.js"

export const parseSvgRessource = async (
  svgRessource,
  { notifyReferenceFound, minify, minifyHtmlOptions },
) => {
  const svgString = String(svgRessource.bufferBeforeBuild)
  const svgAst = await parseSvgString(svgString)
  const svgMutations = collectHtmlMutations(
    svgAst,
    [imageVisitor, useVisitor],
    {
      notifyReferenceFound,
    },
  )
  return async ({ getUrlRelativeToImporter }) => {
    svgMutations.forEach((mutationCallback) => {
      mutationCallback({ getUrlRelativeToImporter })
    })
    const svgAfterTransformation = stringifyHtmlAst(svgAst)
    // could also benefit of minification https://github.com/svg/svgo
    if (minify) {
      svgRessource.buildEnd(
        await minifyHtml(svgAfterTransformation, minifyHtmlOptions),
      )
      return
    }
    svgRessource.buildEnd(svgAfterTransformation)
  }
}

export const imageVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName !== "image") {
    return null
  }
  const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
  if (!hrefAttribute) {
    return null
  }
  const hrefReference = notifyReferenceFound({
    referenceLabel: "svg image href",
    ressourceSpecifier: hrefAttribute.value,
    ...referenceLocationFromHtmlNode(node, "href"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getUrlRelativeToImporter)
    hrefAttribute.value = hrefNewValue
  }
}

export const useVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName !== "use") {
    return null
  }
  const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
  if (!hrefAttribute) {
    return null
  }
  const href = hrefAttribute.value
  const { hash } = new URL(href, "file://")
  const hrefReference = notifyReferenceFound({
    referenceLabel: "svg use href",
    ressourceSpecifier: href,
    ...referenceLocationFromHtmlNode(node, "href"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getUrlRelativeToImporter)
    hrefAttribute.value = `${hrefNewValue}${hash}`
  }
}

const referenceToUrl = (reference, getUrlRelativeToImporter) => {
  const { ressource } = reference
  if (ressource.isInline) {
    return getRessourceAsBase64Url(ressource)
  }
  return getUrlRelativeToImporter(ressource)
}

const referenceLocationFromHtmlNode = (htmlNode, htmlAttributeName) => {
  const locInfo = getHtmlNodeLocation(htmlNode, htmlAttributeName)
  return locInfo
    ? {
        referenceLine: locInfo.line,
        referenceColumn: locInfo.column,
      }
    : {}
}
