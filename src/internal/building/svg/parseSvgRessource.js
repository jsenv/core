import {
  parseSvgString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
  getHtmlNodeLocation,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { collectNodesMutations } from "../parsing.utils.js"
import { getRessourceAsBase64Url } from "../ressource_builder_util.js"
import { minifyHtml } from "../html/minifyHtml.js"

export const parseSvgRessource = async (
  svgRessource,
  notifiers,
  { minify, minifyHtmlOptions },
) => {
  const svgString = String(svgRessource.bufferBeforeBuild)
  const svgAst = await parseSvgString(svgString)
  const htmlRessources = parseHtmlAstRessources(svgAst)
  const mutations = collectSvgMutations(htmlRessources, notifiers, svgRessource)

  return async ({ getUrlRelativeToImporter }) => {
    mutations.forEach((mutationCallback) => {
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

export const collectSvgMutations = (
  { images, uses },
  notifiers,
  svgRessource,
) => {
  const imagesMutations = collectNodesMutations(
    images,
    notifiers,
    svgRessource,
    [imageHrefVisitor],
  )
  const usesMutations = collectNodesMutations(uses, notifiers, svgRessource, [
    useHrefVisitor,
  ])
  const svgMutations = [...imagesMutations, ...usesMutations]
  return svgMutations
}

const imageHrefVisitor = (image, { notifyReferenceFound }) => {
  const hrefAttribute = getHtmlNodeAttributeByName(image, "href")
  if (!hrefAttribute) {
    return null
  }

  const hrefReference = notifyReferenceFound({
    ressourceSpecifier: hrefAttribute.value,
    ...referenceLocationFromHtmlNode(image, "href"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getUrlRelativeToImporter)
    hrefAttribute.value = hrefNewValue
  }
}

const useHrefVisitor = (use, { notifyReferenceFound }) => {
  const hrefAttribute = getHtmlNodeAttributeByName(use, "href")
  if (!hrefAttribute) {
    return null
  }
  const href = hrefAttribute.value
  if (href[0] === "#") {
    return null
  }

  const { hash } = new URL(href, "file://")
  const hrefReference = notifyReferenceFound({
    ressourceSpecifier: href,
    ...referenceLocationFromHtmlNode(use, "href"),
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
