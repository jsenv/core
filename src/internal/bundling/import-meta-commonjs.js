// eslint-disable-next-line import/no-unresolved
import importMap from "/importMap.json"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"

const nodeRequire = require
export { nodeRequire as require }

const filenameContainsBackSlashes = __filename.indexOf("\\") > -1

export const url = filenameContainsBackSlashes
  ? `file://${__filename.replace(/\\/g, "/")}`
  : `file://${__filename}`

export const resolve = (specifier) => {
  return resolveImport({
    specifier,
    importer: url,
    importMap: memoizedGetImportMap(),
    defaultExtension: false,
  })
}

// better for perf and helps rollup to tree shake this out
// when import.meta.resolve is not used
let memoizedImportMap
const memoizedGetImportMap = () => {
  if (memoizedImportMap) return memoizedImportMap
  memoizedImportMap = normalizeImportMap(importMap, url)
  return memoizedImportMap
}
