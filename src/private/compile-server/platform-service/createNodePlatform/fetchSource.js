import { fetchUsingFileSystem } from "./fetchUsingFileSystem.js"
import { fetchUsingHttp } from "./fetchUsingHttp.js"

export const fetchSource = ({ url, importerUrl, executionId }) => {
  if (protocolIsFile(url)) {
    return fetchUsingFileSystem(url, importerUrl)
  }

  if (protocolIsHttpOrHttps(url)) {
    return fetchUsingHttp(url, {
      headers: {
        ...(executionId ? { "x-jsenv-execution-id": executionId } : {}),
      },
    })
  }

  throw new Error(`unsupported protocol for module ${url}`)
}

const protocolIsFile = (url) => {
  return url.indexOf("file:") === 0
}

const protocolIsHttpOrHttps = (url) => {
  return url.indexOf("http:") === 0 || url.indexOf("https:") === 0
}
