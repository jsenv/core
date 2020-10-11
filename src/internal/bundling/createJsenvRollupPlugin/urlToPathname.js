import { urlToScheme } from "./urlToScheme.js"

export const urlToPathname = (urlString) => {
  return ressourceToPathname(urlToRessource(urlString))
}

const urlToRessource = (urlString) => {
  const scheme = urlToScheme(urlString)

  if (scheme === "file") {
    return urlString.slice("file://".length)
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length)
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length)
    return afterProtocol.slice(pathnameSlashIndex)
  }

  return urlString.slice(scheme.length + 1)
}

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?")
  return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex)
}
