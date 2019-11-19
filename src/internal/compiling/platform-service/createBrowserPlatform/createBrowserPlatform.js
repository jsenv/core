/* eslint-disable import/max-dependencies */
import {
  compileDirectoryRelativeUrl,
  groupMap,
  importDefaultExtension,
  importMap,
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/env.json"
import { uneval } from "@jsenv/uneval"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport/resolveImport.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../resolveBrowserGroup.js"
import { memoizeOnce } from "../memoizeOnce.js"
import { createBrowserSystem } from "./createBrowserSystem.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"

const GLOBAL_SPECIFIER = "global"
const memoizedCreateBrowserSystem = memoizeOnce(createBrowserSystem)

export const createBrowserPlatform = ({ compileServerOrigin }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup({ groupMap }),
    groupMap,
  })

  const relativeUrlToCompiledUrl = (relativeUrl) => {
    return `${compileServerOrigin}/${compileDirectoryRelativeUrl}${compileId}/${relativeUrl}`
  }

  const importMapNormalized = normalizeImportMap(
    importMap,
    `${compileServerOrigin}/${compileDirectoryRelativeUrl}${compileId}/`,
  )

  const resolveImportScoped = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier
    return resolveImport({
      specifier,
      importer,
      importMap: importMapNormalized,
      defaultExtension: importDefaultExtension,
    })
  }

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      resolveImport: resolveImportScoped,
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
      compileDirectoryRelativeUrl,
      resolveImport: resolveImportScoped,
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

  return {
    relativeUrlToCompiledUrl,
    resolveImportScoped,
    importFile,
    executeFile,
  }
}

const unevalException = (value) => {
  return uneval(value)
}

const readCoverage = () => window.__coverage__

const displayErrorInConsole = (error) => {
  console.error(error)
}
