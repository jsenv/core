/**
 * allows the following:
 *
 * import "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
 * -> searches a file inside @jsenv/core/*
 *
 */

import { urlToRelativeUrl, urlIsInsideOf, resolveUrl } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

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
  const jsenvCoreRelativeUrl = urlToRelativeUrl(jsenvCoreUrl, url)
  const importmap = {
    imports: {
      "@jsenv/core/": `./${jsenvCoreRelativeUrl}`,
    },
  }
  return importmap
}
