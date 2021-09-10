import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

// in case there is no importmap, force the presence
// so that '@jsenv/core/' are still remapped
export const getDefaultImportMap = ({
  importMapFileUrl,
  projectDirectoryUrl,
  compileDirectoryRelativeUrl,
}) => {
  const compileDirectoryUrl = resolveUrl(
    compileDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const jsenvCoreDirectoryRelativeUrl = urlToRelativeUrl(
    jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
  )
  const jsenvCoreDirectoryCompileUrl = resolveUrl(
    jsenvCoreDirectoryRelativeUrl,
    compileDirectoryUrl,
  )
  const jsenvCoreDirectoryUrlRelativeToImportMap = urlToRelativeUrl(
    jsenvCoreDirectoryCompileUrl,
    importMapFileUrl,
  )

  return {
    imports: {
      "@jsenv/core/": jsenvCoreDirectoryUrlRelativeToImportMap,
    },
  }
}
