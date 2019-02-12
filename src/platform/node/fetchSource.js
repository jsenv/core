import { fetchUsingFileSystem } from "./fetchUsingFileSystem.js"
import { fetchUsingHttp } from "./fetchUsingHttp.js"

const protocolIsFile = (url) => {
  return url.indexOf("file:") === 0
}

const protocolIsHttpOrHttps = (url) => {
  return url.indexOf("http:") === 0 || url.indexOf("https:") === 0
}

export const fetchSource = ({ href, importer }) => {
  if (protocolIsFile(href)) {
    return fetchUsingFileSystem(href, importer)
  }

  if (protocolIsHttpOrHttps(href)) {
    return fetchUsingHttp(href, {
      headers: {
        "x-module-referer": importer || href,
      },
    })
  }

  throw new Error(`unsupported protocol for module ${href}`)
}
