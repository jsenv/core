import { urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"

export const moveUrl = (url, from, to) => {
  const relativeUrl = urlToRelativeUrl(url, from)
  return resolveUrl(relativeUrl, to)
}

export const asUrlWithoutSearch = (url) => {
  const urlObject = new URL(url)
  urlObject.search = ""
  return urlObject.href
}
