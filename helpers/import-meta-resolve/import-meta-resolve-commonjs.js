import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"

const importMapFileRelativeUrl = import.meta.jsenv.importMapFileRelativeUrl
const importmapUrl = new URL(importMapFileRelativeUrl, import.meta.url)

const resolve = (specifier) => {
  return Promise.resolve(
    resolveImport({
      specifier,
      importer: import.meta.url,
      importMap: memoizedGetImportMap(),
      defaultExtension: false,
    }),
  )
}

// better for perf and helps rollup to tree shake this out
// when import.meta.resolve is not used
let importmapPromise
const memoizedGetImportMap = () => {
  if (importmapPromise) {
    return importmapPromise
  }
  importmapPromise = getImportMap()
  return importmapPromise
}

const getImportMap = async () => {
  const response = await fetchUrl(importmapUrl)
  const importmap = await response.json()
  const importmapNormalized = normalizeImportMap(importmap, importmapUrl)
  return importmapNormalized
}

export default resolve
