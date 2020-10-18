export const getTargetAsBase64Url = ({ sourceAfterTransformation, content }) => {
  return createBase64UrlString(sourceAfterTransformation, content.type)
}

const createBase64UrlString = (source, contentType) => {
  if (contentType === "text/plain;charset=US-ASCII") {
    if (Buffer.byteLength(source) === 0) {
      return `data:,`
    }
    return `data:,${Buffer.from(source).toString("base64")}`
  }
  return `data:${contentType};base64,${Buffer.from(source).toString("base64")}`
}
