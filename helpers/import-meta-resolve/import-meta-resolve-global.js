import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
import { fetchUrl } from "@jsenv/core/src/internal/toolbar/util/fetching.js"
import url from "../import-meta-url/import-meta-url-global.js"

const resolve = (specifier) => {
  return Promise.resolve(
    resolveImport({
      specifier,
      importer: url,
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
  const importMapFileRelativeUrl = import.meta.jsenv.importmapFileRelativeUrl
  importmapPromise = (async () => {
    const importmapUrl = new URL(importMapFileRelativeUrl, window.location).href
    const response = await fetchUrl(importmapUrl)
    const importmap = await response.json()
    const importmapNormalized = normalizeImportMap(importmap, importmapUrl)
    return importmapNormalized
  })()
  return importmapPromise
}

export default resolve
