/**
 * allows the following:
 *
 * import "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
 * -> searches a file inside @jsenv/core/*
 *
 */

import { urlToRelativeUrl, urlIsInsideOf, resolveUrl } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const getDefaultImportmap = (
  url,
  { projectDirectoryUrl, compileDirectoryUrl },
) => {
  const jsenvCoreDirectoryRelativeUrl = urlToRelativeUrl(
    jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
  )

  let jsenvCoreUrl
  if (compileDirectoryUrl && urlIsInsideOf(url, compileDirectoryUrl)) {
    jsenvCoreUrl = resolveUrl(
      jsenvCoreDirectoryRelativeUrl,
      compileDirectoryUrl,
    )
  } else {
    jsenvCoreUrl = jsenvCoreDirectoryUrl
  }

  const importmap = {
    imports: {
      "@jsenv/core/": makeRelativeMapping(jsenvCoreUrl, url),
    },
  }
  return importmap
}

// this function just here to ensure relative urls starts with './'
// so that importmap do not consider them as bare specifiers
const makeRelativeMapping = (url, baseUrl) => {
  const relativeUrl = urlToRelativeUrl(url, baseUrl)

  if (urlIsInsideOf(url, baseUrl)) {
    if (relativeUrl.startsWith("../")) return relativeUrl
    if (relativeUrl.startsWith("./")) return relativeUrl
    return `./${relativeUrl}`
  }

  return relativeUrl
}
