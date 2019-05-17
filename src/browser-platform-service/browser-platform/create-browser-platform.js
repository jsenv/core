// "/.jsenv/browser-platform-data.js" resolved at build time
// eslint-disable-next-line import/no-unresolved
import { compileIntoRelativePath, groupMap } from "/.jsenv/browser-platform-data.js"
// "/.jsenv/browser-group-resolver.js" resolved at build time
// eslint-disable-next-line import/no-unresolved
import { resolveBrowserGroup } from "/.jsenv/browser-group-resolver.js"
// "/.jsenv/import-map.json" resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/import-map.json"
import { uneval } from "@dmail/uneval"
import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { createBrowserSystem } from "./create-browser-system.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"

const memoizedCreateBrowserSystem = memoizeOnce(createBrowserSystem)

export const createBrowserPlatform = ({ compileServerOrigin }) => {
  const compileId = decideCompileId()

  const relativePathToCompiledHref = (relativePath) => {
    return `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${relativePath}`
  }

  const wrappedImportMap = wrapImportMap(
    importMap,
    `${compileIntoRelativePath.slice(1)}/${compileId}`,
  )

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileIntoRelativePath,
      importMap: wrappedImportMap,
    })
    return browserSystem.import(specifier)
  }

  const executeFile = async (specifier, { collectCoverage, collectNamespace } = {}) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileIntoRelativePath,
      importMap: wrappedImportMap,
    })
    try {
      const namespace = await browserSystem.import(specifier)
      return {
        status: "resolved",
        namespace: collectNamespace ? namespace : undefined,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    } catch (error) {
      displayErrorInDocument(error)
      displayErrorInConsole(error)
      return {
        status: "rejected",
        exceptionSource: unevalException(error),
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }
  }

  return { relativePathToCompiledHref, importFile, executeFile }
}

const unevalException = (value) => {
  return uneval(value, { accurateErrorProperties: true })
}

const decideCompileId = () => {
  const returnedGroupId = resolveBrowserGroup({ groupMap })
  if (typeof returnedGroupId === "undefined") return "otherwise"

  if (returnedGroupId in groupMap === false) {
    throw new Error(
      `resolveBrowserGroup must return one of ${Object.keys(groupMap)}, got ${returnedGroupId}`,
    )
  }

  return returnedGroupId
}

const readCoverage = () => window.__coverage__

const displayErrorInConsole = (error) => {
  console.error(error)
}
