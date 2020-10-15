import {
  setHtmlNodeAttributeValue,
  getHtmlNodeAttributeValue,
  getHtmlNodeLocation,
} from "../../compiling/compileHtml.js"
import { getTargetAsBase64Url } from "./getTargetAsBase64Url.js"

// could also benefit of minification https://github.com/svg/svgo
// and also we maybe should parse svg because it can contains images and stuff
// for now let's forget

export const parseSvgAsset = ({ target }) => {
  return () => {
    return target.content.value
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
