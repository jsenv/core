import { urlToRelativeUrl } from "./urlToRelativeUrl.js"

export const moveUrl = ({ url, from, to, preferAbsolute = false }) => {
  const relativeUrl = urlToRelativeUrl(url, from)
  const absoluteUrl = new URL(relativeUrl, to).href
  if (preferAbsolute) {
    return absoluteUrl
  }
  return urlToRelativeUrl(absoluteUrl, to)
}
