/* eslint-disable import/max-dependencies */

// we might want to reuse fetchUrl approach used by nodePlatform
// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import importMap from "/.jsenv/out/importMap.json"
// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"

import { uneval } from "@jsenv/uneval"
import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { resolveImport } from "@jsenv/import-map/src/resolveImport.js"
// do not use memoize form @jsenv/util to avoid pulling @jsenv/util code into the browser bundle
import { memoize } from "../../memoize.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../resolveBrowserGroup.js"
import { createBrowserSystem } from "./createBrowserSystem.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"

const GLOBAL_SPECIFIER = "global"
const memoizedCreateBrowserSystem = memoize(createBrowserSystem)
const { outDirectoryRelativeUrl, importDefaultExtension } = env

export const createBrowserPlatform = ({ compileServerOrigin }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup({ groupMap }),
    groupMap,
  })
  const compileDirectoryRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/`

  // yes but it won't work for bundlep served dynamically
  // where the compileId concerns the bundle
  // it makes anything using @jsenv not working because
  // they cannot find files related to jsenv
  const importMapNormalized = normalizeImportMap(importMap, compileDirectoryRemoteUrl)

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
      executionExposureOnWindow = false,
      errorTransform = (error) => error,
      executionId,
    } = {},
  ) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      resolveImport: resolveImportScoped,
      executionId,
    })

    let executionResult
    try {
      const namespace = await browserSystem.import(specifier)
      executionResult = {
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

      executionResult = {
        status: "errored",
        exceptionSource: unevalException(transformedError),
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }

    if (executionExposureOnWindow) {
      window.__executionResult__ = executionResult
    }

    return executionResult
  }

  return {
    compileDirectoryRemoteUrl,
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
