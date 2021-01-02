let importResolverPromise
export const getImportResolver = (importMetaUrl) => {
  if (importResolverPromise) {
    return importResolverPromise
  }

  importResolverPromise = _getImportResolver(importMetaUrl)
  return importResolverPromise
}

const _getImportResolver = async (importMetaUrl) => {
  const importMapFileRelativeUrl = await import("@jsenv/core/__context__")
  const { fetchUrl } = await import("@jsenv/core/src/internal/fetchUrl.js")
  const { normalizeImportMap } = await import("@jsenv/import-map/src/normalizeImportMap.js")
  const { resolveImport } = await import("@jsenv/import-map/src/resolveImport.js")
  // import { fetchUrl } from "@jsenv/core/src/internal/toolbar/util/fetching.js"

  const importmapUrl = new URL(importMapFileRelativeUrl, importMetaUrl)

  const response = await fetchUrl(importmapUrl)
  const importmap = await response.json()
  const importmapNormalized = normalizeImportMap(importmap, importmapUrl)

  return (specifier, importer) => {
    return resolveImport({
      specifier,
      importer,
      importMap: importmapNormalized,
      defaultExtension: false,
    })
  }
}
