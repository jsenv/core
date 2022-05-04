import { existsSync } from "node:fs"

import { getParentUrl, asDirectoryUrl } from "./url_utils.js"

export const lookupPackageScope = (url) => {
  let scopeUrl = asDirectoryUrl(url)
  while (scopeUrl !== "file:///") {
    if (scopeUrl.endsWith("node_modules/")) {
      return null
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl)
    if (existsSync(packageJsonUrlObject)) {
      return scopeUrl
    }
    scopeUrl = getParentUrl(scopeUrl)
  }
  return null
}
