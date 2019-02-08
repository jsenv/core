import { fetchUsingFileSystem } from "./fetchUsingFileSystem.js"
import { fetchUsingHttp } from "./fetchUsingHttp.js"

const protocolIsFile = (url) => {
  return url.indexOf("file:") === 0
}

const protocolIsHttpOrHttps = (url) => {
  return url.indexOf("http:") === 0 || url.indexOf("https:") === 0
}

export const fetchSource = ({ remoteFile, remoteParent }) => {
  if (protocolIsFile(remoteFile)) {
    return fetchUsingFileSystem(remoteFile, remoteParent)
  }

  if (protocolIsHttpOrHttps(remoteFile)) {
    return fetchUsingHttp(remoteFile, {
      headers: {
        "x-module-referer": remoteParent || remoteFile,
      },
    })
  }

  throw new Error(`unsupported protocol for module ${remoteFile}`)
}
