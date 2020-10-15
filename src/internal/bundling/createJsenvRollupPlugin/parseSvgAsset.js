import {
  parseSvgString,
  parseHtmlAstRessources,
  setHtmlNodeAttributeValue,
  getHtmlNodeAttributeValue,
  getHtmlNodeLocation,
  stringifyHtmlAst,
} from "../../compiling/compileHtml.js"
import { minifyHtml } from "./minifyHtml.js"
import { getTargetAsBase64Url } from "./getTargetAsBase64Url.js"

export const parseSvgAsset = async (
  target,
  { notifyAssetFound },
  { minify, minifyHtmlOptions },
) => {
  const svgString = String(target.content.value)
  const svgAst = await parseSvgString(svgString)
  const htmlRessources = parseHtmlAstRessources(svgAst)
  const mutations = getMutationsForSvgNodes(htmlRessources, { notifyAssetFound })

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

export const getMutationsForSvgNodes = ({ images, uses }, { notifyAssetFound }) => {
  const mutations = []

  images.forEach((image) => {
    const href = getHtmlNodeAttributeValue(image, "href")
    if (href) {
      const hrefReference = notifyAssetFound({
        specifier: href,
        ...getHtmlNodeLocation(image),
      })
      mutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter)
        setHtmlNodeAttributeValue(image, "href", hrefNewValue)
      })
    }
  })
  uses.forEach((use) => {
    const href = getHtmlNodeAttributeValue(use, "href")
    if (href) {
      if (href[0] === "#") return

      const { hash } = new URL(href, "file://")
      const hrefReference = notifyAssetFound({
        specifier: href,
        ...getHtmlNodeLocation(use),
      })
      mutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter)
        setHtmlNodeAttributeValue(use, "href", `${hrefNewValue}${hash}`)
      })
    }
  })

  return mutations
}

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const { isInline } = reference.target
  if (isInline) {
    return getTargetAsBase64Url(reference.target)
  }
  return getReferenceUrlRelativeToImporter(reference)
}
