import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
// import { fetchUrl } from "@jsenv/core/src/internal/toolbar/util/fetching.js"
import { fetchUsingXHR } from "@jsenv/core/src/internal/fetchUsingXHR.js"

const importMapFileRelativeUrl = import.meta.jsenv.importmapFileRelativeUrl
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

  importmapPromise = (async () => {
    const response = await fetchUsingXHR(importmapUrl)
    const importmap = await response.json()
    const importmapNormalized = normalizeImportMap(importmap, importmapUrl)
    return importmapNormalized
  })()
  return importmapPromise
}

export default resolve
