import {
  compileIntoRelativePath,
  groupMap,
  importDefaultExtension,
  // "/.jsenv/browser-platform-data.js" resolved at build time
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/browser-platform-data.js"
// "/.jsenv/import-map.json" resolved at build time
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/import-map.json"
import { resolvePath } from "@jsenv/module-resolution"
import { uneval } from "@dmail/uneval"
import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { resolveBrowserGroup, computeCompileIdFromGroupId } from "@jsenv/grouping"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { createBrowserSystem } from "./create-browser-system.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"

const GLOBAL_SPECIFIER = "global"
const memoizedCreateBrowserSystem = memoizeOnce(createBrowserSystem)

export const createBrowserPlatform = ({ compileServerOrigin }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup({ groupMap }),
    groupMap,
  })

  const relativePathToCompiledHref = (relativePath) => {
    return `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${relativePath}`
  }

  const wrappedImportMap = wrapImportMap(
    importMap,
    `${compileIntoRelativePath.slice(1)}/${compileId}`,
  )

  const resolveImport = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier
    return resolvePath({
      specifier,
      importer,
      importMap: wrappedImportMap,
      defaultExtension: importDefaultExtension,
    })
  }

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileIntoRelativePath,
      resolveImport,
    })
    return browserSystem.import(specifier)
  }

  const executeFile = async (
    specifier,
    {
      collectCoverage,
      collectNamespace,
      errorExposureInConsole = true,
      errorExposureInNotification = false,
      errorExposureInDocument = true,
      errorTransform = (error) => error,
      executionId,
    } = {},
  ) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileIntoRelativePath,
      resolveImport,
      executionId,
    })
    try {
      const namespace = await browserSystem.import(specifier)
      return {
        status: "completed",
        namespace: collectNamespace ? namespace : undefined,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    } catch (error) {
      let transformedError
      try {
        transformedError = await errorTransform(error)
      } catch (e) {
        transformedError = error
      }

      if (errorExposureInConsole) displayErrorInConsole(transformedError)
      if (errorExposureInNotification) displayErrorNotification(transformedError)
      if (errorExposureInDocument) displayErrorInDocument(transformedError)

      return {
        status: "errored",
        exceptionSource: unevalException(transformedError),
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }
  }

  return { relativePathToCompiledHref, resolveImport, importFile, executeFile }
}

const unevalException = (value) => {
  return uneval(value)
}

const readCoverage = () => window.__coverage__

const displayErrorInConsole = (error) => {
  console.error(error)
}
