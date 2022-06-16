import { urlToRelativeUrl } from "./url_to_relative_url.js"

export const moveUrl = ({ url, from, to, preferAbsolute = false }) => {
  let relativeUrl = urlToRelativeUrl(url, from)
  if (relativeUrl.slice(0, 2) === "//") {
    // restore the protocol
    relativeUrl = new URL(relativeUrl, url).href
  }
  const absoluteUrl = new URL(relativeUrl, to).href
  if (preferAbsolute) {
    return absoluteUrl
  }
  return urlToRelativeUrl(absoluteUrl, to)
}
