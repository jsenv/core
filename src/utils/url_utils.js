import { urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"

// TODO: move "filesystemRootUrl" and "moveUrl" to @jsenv/filesystem
export const filesystemRootUrl =
  process.platform === "win32" ? `file///${process.cwd()[0]}:/` : "file:///"

// I would expect moveUrl to move url trying to keep it relative to the destination
// TODO: rename this function moveAbsoluteUrl and write a moveUrl which tries to keep url relative
export const moveUrl = (url, from, to) => {
  const relativeUrl = urlToRelativeUrl(url, from)
  return resolveUrl(relativeUrl, to)
}

export const asUrlWithoutSearch = (url) => {
  const urlObject = new URL(url)
  urlObject.search = ""
  return urlObject.href
}

export const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

export const injectQueryParams = (url, params) => {
  const urlObject = new URL(url)
  Object.keys(params).forEach((key) => {
    urlObject.searchParams.set(key, params[key])
  })
  const urlWithParams = urlObject.href
  // injectQueryParams('http://example.com/file.js', { hmr: '' })
  // returns
  // "http://example.com/file.js?hmr="
  // It is technically valid but "=" signs hurts readability
  return urlWithParams.replace(/[=](?=&|$)/g, "")
}
