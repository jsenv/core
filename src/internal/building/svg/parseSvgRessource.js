import {
  parseSvgString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import {
  collectNodesMutations,
  htmlNodeToReferenceLocation,
} from "../parsing.utils.js"
import { getRessourceAsBase64Url } from "../asset-builder.util.js"
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

  return ({ getReferenceUrlRelativeToImporter }) => {
    mutations.forEach((mutationCallback) => {
      mutationCallback({ getReferenceUrlRelativeToImporter })
    })
    const svgAfterTransformation = stringifyHtmlAst(svgAst)
    // could also benefit of minification https://github.com/svg/svgo
    return minify
      ? minifyHtml(svgAfterTransformation, minifyHtmlOptions)
      : svgAfterTransformation
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
    ...htmlNodeToReferenceLocation(image),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(
      hrefReference,
      getReferenceUrlRelativeToImporter,
    )
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
    ...htmlNodeToReferenceLocation(use),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(
      hrefReference,
      getReferenceUrlRelativeToImporter,
    )
    hrefAttribute.value = `${hrefNewValue}${hash}`
  }
}

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const { isInline } = reference.ressource
  if (isInline) {
    return getRessourceAsBase64Url(reference.ressource)
  }
  return getReferenceUrlRelativeToImporter(reference)
}
