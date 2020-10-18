import { stringifyDataUrl } from "../dataUrl.utils.js"

export const getTargetAsBase64Url = ({ sourceAfterTransformation, content }) => {
  return stringifyDataUrl({
    data: sourceAfterTransformation,
    base64Flag: true,
    mediaType: content.type,
  })
}
