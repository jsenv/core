import { urlToPathname } from "./internal/urlToPathname.js"
import { pathnameToExtension } from "./internal/pathnameToExtension.js"
import { resolveUrl } from "./resolveUrl.js"
import { applyImportMap } from "./applyImportMap.js"

export const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = false,
  createBareSpecifierError,
  onImportMapping = () => {},
}) => {
  let url
  if (importMap) {
    url = applyImportMap({
      importMap,
      specifier,
      importer,
      createBareSpecifierError,
      onImportMapping,
    })
  } else {
    url = resolveUrl(specifier, importer)
  }

  if (defaultExtension) {
    url = applyDefaultExtension({ url, importer, defaultExtension })
  }

  return url
}

const applyDefaultExtension = ({ url, importer, defaultExtension }) => {
  if (urlToPathname(url).endsWith("/")) {
    return url
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension(url)
    if (extension === "") {
      return `${url}${defaultExtension}`
    }
    return url
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension(url)
    if (extension === "" && importer) {
      const importerPathname = urlToPathname(importer)
      const importerExtension = pathnameToExtension(importerPathname)
      return `${url}${importerExtension}`
    }
  }

  return url
}
