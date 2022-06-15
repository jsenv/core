import { urlToRelativeUrl } from "./url_to_relative_url.js"

export const moveUrl = ({ url, from, to, preferAbsolute = false }) => {
  const relativeUrl = urlToRelativeUrl(url, from)
  const absoluteUrl = new URL(relativeUrl, to).href
  if (preferAbsolute) {
    return absoluteUrl
  }
  return urlToRelativeUrl(absoluteUrl, to)
}
