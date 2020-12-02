import {
  parseSvgString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  getHtmlNodeLocation,
  stringifyHtmlAst,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { collectNodesMutations } from "../parsing.utils.js"
import { getTargetAsBase64Url } from "../getTargetAsBase64Url.js"
import { minifyHtml } from "../html/minifyHtml.js"

export const parseSvgAsset = async (target, notifiers, { minify, minifyHtmlOptions }) => {
  const svgString = String(target.content.value)
  const svgAst = await parseSvgString(svgString)
  const htmlRessources = parseHtmlAstRessources(svgAst)
  const mutations = collectSvgMutations(htmlRessources, notifiers, target)

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

export const collectSvgMutations = ({ images, uses }, notifiers, target) => {
  const imagesMutations = collectNodesMutations(images, notifiers, target, [imageHrefVisitor])
  const usesMutations = collectNodesMutations(uses, notifiers, target, [useHrefVisitor])
  const svgMutations = [...imagesMutations, ...usesMutations]
  return svgMutations
}

const imageHrefVisitor = (image, { notifyReferenceFound }) => {
  const hrefAttribute = getHtmlNodeAttributeByName(image, "href")
  if (!hrefAttribute) {
    return null
  }

  const hrefReference = notifyReferenceFound({
    specifier: hrefAttribute.value,
    ...getHtmlNodeLocation(image),
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
    specifier: href,
    ...getHtmlNodeLocation(use),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter)
    hrefAttribute.value = `${hrefNewValue}${hash}`
  }
}

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const { isInline } = reference.target
  if (isInline) {
    return getTargetAsBase64Url(reference.target)
  }
  return getReferenceUrlRelativeToImporter(reference)
}
