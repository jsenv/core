import { existsSync } from "node:fs"

export const determineJsenvInternalDirectoryUrl = (rootDirectoryUrl) => {
  const firstNodeModuleDirectory =
    findFirstNodeModuleDirectory(rootDirectoryUrl)
  if (firstNodeModuleDirectory) {
    return `${firstNodeModuleDirectory}.jsenv/`
  }
  return `${rootDirectoryUrl}.jsenv/`
}

const findFirstNodeModuleDirectory = (directoryUrl) => {
  let currentUrl = directoryUrl
  while (currentUrl !== "file:///") {
    const nodeModuleDirectoryUrl = `${directoryUrl}node_modules/`
    if (existsSync(new URL(nodeModuleDirectoryUrl))) {
      return nodeModuleDirectoryUrl
    }
    currentUrl = getParentUrl(currentUrl)
  }
  return null
}

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
