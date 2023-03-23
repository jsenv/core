import { basename } from "node:path"

import { lookupPackageDirectory } from "./lookup_package_directory.js"

export const determineJsenvInternalDirectoryUrl = (currentUrl) => {
  const packageDirectoryUrl = lookupPackageDirectory(currentUrl)
  if (packageDirectoryUrl) {
    return `${packageDirectoryUrl}.jsenv/${getDirectoryName(
      packageDirectoryUrl,
    )}/`
  }
  return `${currentUrl}.jsenv/`
}

const getDirectoryName = (directoryUrl) => {
  const { pathname } = new URL(directoryUrl)
  return basename(pathname)
}
