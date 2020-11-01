// eslint-disable-next-line import/no-unresolved
import importMap from "/jsenv.importmap"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
import url from "./import-meta-url-global.js"

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
let memoizedImportMap
const memoizedGetImportMap = () => {
  if (memoizedImportMap) return memoizedImportMap
  memoizedImportMap = normalizeImportMap(importMap, url)
  return memoizedImportMap
}

export default resolve
