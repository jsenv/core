import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import url from "../import-meta-url/import-meta-url-commonjs.js"

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
    const importmapUrl = new URL(importMapFileRelativeUrl, url)
    const response = await fetchUrl(importmapUrl)
    const importmap = await response.json()
    const importmapNormalized = normalizeImportMap(importmap, url)
    return importmapNormalized
  })()
  return importmapPromise
}

export default resolve
