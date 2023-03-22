import { existsSync } from "node:fs"
import { basename } from "node:path"

export const determineJsenvInternalDirectoryUrl = (rootDirectoryUrl) => {
  const immediateNodeModuleDirectoryUrl = `${rootDirectoryUrl}node_modules/`
  if (testDirectoryPresence(immediateNodeModuleDirectoryUrl)) {
    return `${immediateNodeModuleDirectoryUrl}.jsenv/${getDirectoryName(
      rootDirectoryUrl,
    )}/`
  }
  const parentUrl = getParentUrl(rootDirectoryUrl)
  const parentNodeModuleDirectoryUrl = `${parentUrl}node_modules/`
  if (testDirectoryPresence(parentNodeModuleDirectoryUrl)) {
    return `${parentNodeModuleDirectoryUrl}.jsenv/${getDirectoryName(
      parentUrl,
    )}`
  }
  return `${rootDirectoryUrl}.jsenv/`
}

const getDirectoryName = (directoryUrl) => {
  const { pathname } = new URL(directoryUrl)
  return basename(pathname)
}

const testDirectoryPresence = (directoryUrl) =>
  existsSync(new URL(directoryUrl))

const getParentUrl = (url) => {
  if (url.startsWith("file://")) {
    // With node.js new URL('../', 'file:///C:/').href
    // returns "file:///C:/" instead of "file:///"
    const resource = url.slice("file://".length)
    const slashLastIndex = resource.lastIndexOf("/")
    if (slashLastIndex === -1) {
      return url
    }
    const lastCharIndex = resource.length - 1
    if (slashLastIndex === lastCharIndex) {
      const slashBeforeLastIndex = resource.lastIndexOf("/", slashLastIndex - 1)
      if (slashBeforeLastIndex === -1) {
        return url
      }
      return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`
    }
    return `file://${resource.slice(0, slashLastIndex + 1)}`
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href
}
