import { fetchModuleFromFileSystem } from "./fetchModuleFromFileSystem.js"
import { fetchModuleFromServer } from "./fetchModuleFromServer.js"

const protocolIsFile = (url) => {
  return url.indexOf("file:") === 0
}

const protocolIsHttpOrHttps = (url) => {
  return url.indexOf("http:") === 0 || url.indexOf("https:") === 0
}

export const fetchModule = (url, parent) => {
  if (protocolIsFile(url)) {
    return fetchModuleFromFileSystem(url, parent)
  }

  if (protocolIsHttpOrHttps(url)) {
    return fetchModuleFromServer(url, parent)
  }

  throw new Error(`unsupported protocol for module ${url}`)
}
