// eslint-disable-next-line import/no-unresolved
import importMap from "/importMap.json"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport/resolveImport.js"

const getCurrentScriptSrc = () => {
  const { currentScript } = document
  if (currentScript) return currentScript.src

  // https://github.com/amiller-gh/currentScript-polyfill

  const scripts = Array.prototype.slice.call(document.getElementsByTagName("script"))

  const readyScript = scripts.find((script) => {
    return script.readyState === "interactive"
  })
  if (readyScript) return readyScript

  try {
    throw new Error()
  } catch (err) {
    // Find the second match for the "at" string to get file src url from stack.
    // Specifically works with the format of stack traces in IE.
    const stackDetails = /.*at [^(]*\((.*):(.+):(.+)\)$/gi.exec(err.stack)
    const scriptLocation = (stackDetails || [false])[1]
    const line = (stackDetails || [false])[2]
    const currentLocation = document.location.href.replace(document.location.hash, "")

    if (scriptLocation === currentLocation) {
      const source = document.documentElement.outerHTML
      const codeRegExp = new RegExp(
        `(?:[^\\n]+?\\n){0,${line - 2}}[^<]*<script>([\\d\\D]*?)<\\/script>[\\d\\D]*`,
        "i",
      )
      const code = source.replace(codeRegExp, "$1").trim()

      return scripts.find((script) => {
        return script.innerHTML && script.innerHTML.trim() === code
      })
    }

    return scripts.find((script) => {
      return script.src === scriptLocation
    })
  }
}

export const url = getCurrentScriptSrc()

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
