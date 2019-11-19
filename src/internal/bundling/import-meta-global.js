// eslint-disable-next-line import/no-unresolved
import { chunkId } from "/.jsenv/env.js"
// eslint-disable-next-line import/no-unresolved
import importMap from "/importMap.json"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport/resolveImport.js"

const { currentScript } = document

export const url = (currentScript && currentScript.src) || new URL(chunkId, document.baseURI).href

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
