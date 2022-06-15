import { urlToScheme } from "./urlToScheme.js"

export const urlToRessource = (url) => {
  const scheme = urlToScheme(url)

  if (scheme === "file") {
    const urlAsStringWithoutFileProtocol = String(url).slice("file://".length)
    return urlAsStringWithoutFileProtocol
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = String(url).slice(scheme.length + "://".length)
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length)
    const urlAsStringWithoutOrigin = afterProtocol.slice(pathnameSlashIndex)
    return urlAsStringWithoutOrigin
  }

  const urlAsStringWithoutProtocol = String(url).slice(scheme.length + 1)
  return urlAsStringWithoutProtocol
}
