import { urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"

// TODO: move "filesystemRootUrl" and "moveUrl" to @jsenv/filesystem
export const filesystemRootUrl =
  process.platform === "win32" ? `file///${process.cwd()[0]}:/` : "file:///"

export const moveUrl = (url, from, to) => {
  const relativeUrl = urlToRelativeUrl(url, from)
  return resolveUrl(relativeUrl, to)
}

export const asUrlWithoutSearch = (url) => {
  const urlObject = new URL(url)
  urlObject.search = ""
  return urlObject.href
}
