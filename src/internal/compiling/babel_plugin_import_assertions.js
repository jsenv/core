import { urlToRelativeUrl } from "@jsenv/filesystem"

import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { babelPluginTransformImportSpecifier } from "./babel_plugin_transform_import_specifier.js"

export const babelPluginImportAssertions = (
  babel,
  { transformCss = false, transformJson = false },
) => {
  return {
    ...babelPluginTransformImportSpecifier(babel, {
      transformImportSpecifier: ({ specifier, assertionsDescriptor }) => {
        const { type } = assertionsDescriptor

        if (type === "css" && transformCss) {
          return forceImportTypeOnSpecifier(specifier, "css")
        }

        if (type === "json" && transformJson) {
          return forceImportTypeOnSpecifier(specifier, "json")
        }

        return specifier
      },
    }),

    name: "transform-import-assertions",
  }
}

const forceImportTypeOnSpecifier = (specifier, importType) => {
  const fakeOrigin = "http://jsenv.com"
  const url = new URL(specifier, fakeOrigin)
  const urlWithImportType = setUrlSearchParamsDescriptor(url, {
    import_type: importType,
  })
  if (urlWithImportType.startsWith(fakeOrigin)) {
    // specifier was relative
    const specifierWithImportType = urlToRelativeUrl(
      urlWithImportType,
      fakeOrigin,
    )
    return `./${specifierWithImportType}`
  }
  return urlWithImportType
}
