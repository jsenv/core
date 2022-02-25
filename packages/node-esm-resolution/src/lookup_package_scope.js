import { existsSync } from "node:fs"

import { getParentUrl } from "./url_utils.js"

export const lookupPackageScope = (url) => {
  let scopeUrl = url
  while (scopeUrl !== "file:///") {
    scopeUrl = getParentUrl(scopeUrl)
    if (scopeUrl.endsWith("node_modules/")) {
      return null
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl)
    if (existsSync(packageJsonUrlObject)) {
      return scopeUrl
    }
  }
  return null
}
