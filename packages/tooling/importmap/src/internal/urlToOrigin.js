import { urlToScheme } from "./urlToScheme.js"

export const urlToOrigin = (urlString) => {
  const scheme = urlToScheme(urlString)

  if (scheme === "file") {
    return "file://"
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex)

    if (pathnameSlashIndex === -1) return urlString
    return urlString.slice(0, pathnameSlashIndex)
  }

  return urlString.slice(0, scheme.length + 1)
}
