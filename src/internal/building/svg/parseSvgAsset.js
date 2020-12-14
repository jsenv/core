import {
  parseSvgString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { collectNodesMutations, htmlNodeToReferenceLocation } from "../parsing.utils.js"
import { getTargetAsBase64Url } from "../asset-builder.util.js"
import { minifyHtml } from "../html/minifyHtml.js"

export const parseSvgAsset = async (svgTarget, notifiers, { minify, minifyHtmlOptions }) => {
  const svgString = String(svgTarget.targetBuffer)
  const svgAst = await parseSvgString(svgString)
  const htmlRessources = parseHtmlAstRessources(svgAst)
  const mutations = collectSvgMutations(htmlRessources, notifiers, svgTarget)

  return ({ getReferenceUrlRelativeToImporter }) => {
    mutations.forEach((mutationCallback) => {
      mutationCallback({ getReferenceUrlRelativeToImporter })
    })
    const svgAfterTransformation = stringifyHtmlAst(svgAst)
    // could also benefit of minification https://github.com/svg/svgo
    const sourceAfterTransformation = minify
      ? minifyHtml(svgAfterTransformation, minifyHtmlOptions)
      : svgAfterTransformation

    return { sourceAfterTransformation }
  }
}

export const collectSvgMutations = ({ images, uses }, notifiers, svgTarget) => {
  const imagesMutations = collectNodesMutations(images, notifiers, svgTarget, [imageHrefVisitor])
  const usesMutations = collectNodesMutations(uses, notifiers, svgTarget, [useHrefVisitor])
  const svgMutations = [...imagesMutations, ...usesMutations]
  return svgMutations
}

const imageHrefVisitor = (image, { notifyReferenceFound }) => {
  const hrefAttribute = getHtmlNodeAttributeByName(image, "href")
  if (!hrefAttribute) {
    return null
  }

  const hrefReference = notifyReferenceFound({
    referenceSpecifier: hrefAttribute.value,
    ...htmlNodeToReferenceLocation(image),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter)
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
    referenceSpecifier: href,
    ...htmlNodeToReferenceLocation(use),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter)
    hrefAttribute.value = `${hrefNewValue}${hash}`
  }
}

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const { targetIsInline } = reference.target
  if (targetIsInline) {
    return getTargetAsBase64Url(reference.target)
  }
  return getReferenceUrlRelativeToImporter(reference)
}
