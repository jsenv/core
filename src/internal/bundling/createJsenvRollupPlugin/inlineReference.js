import { urlToContentType } from "@jsenv/server"

export const inlineReference = ({ target }) => {
  return createBase64UrlString(target.sourceAfterTransformation, urlToContentType(target.url))
}

const createBase64UrlString = (source, contentType) => {
  return `data:${contentType};base64,${Buffer.from(source).toString("base64")}`
}
