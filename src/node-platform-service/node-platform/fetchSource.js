import { fetchUsingFileSystem } from "./fetchUsingFileSystem.js"
import { fetchUsingHttp } from "./fetchUsingHttp.js"

export const fetchSource = ({ href, importerHref, executionId }) => {
  if (protocolIsFile(href)) {
    return fetchUsingFileSystem(href, importerHref)
  }

  if (protocolIsHttpOrHttps(href)) {
    return fetchUsingHttp(href, {
      headers: {
        ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
      },
    })
  }

  throw new Error(`unsupported protocol for module ${href}`)
}

const protocolIsFile = (url) => {
  return url.indexOf("file:") === 0
}

const protocolIsHttpOrHttps = (url) => {
  return url.indexOf("http:") === 0 || url.indexOf("https:") === 0
}
