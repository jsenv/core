/* eslint-disable import/max-dependencies */

// we might want to reuse fetchUrl approach used by nodeRuntime
// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"

import { uneval } from "@jsenv/uneval"
// do not use memoize form @jsenv/util to avoid pulling @jsenv/util code into the browser bundle
import { memoize } from "../../memoize.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../resolveBrowserGroup.js"
import { createBrowserSystem } from "./createBrowserSystem.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"

const memoizedCreateBrowserSystem = memoize(createBrowserSystem)
const { outDirectoryRelativeUrl, importMapFileRelativeUrl, importDefaultExtension } = env

export const createBrowserRuntime = ({ compileServerOrigin }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup(groupMap),
    groupMap,
  })
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      outDirectoryRelativeUrl,
      compileDirectoryRelativeUrl,
      importMapFileRelativeUrl,
      importDefaultExtension,
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
      executionId,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      compileDirectoryRelativeUrl,
      importMapFileRelativeUrl,
      importDefaultExtension,
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
    compileDirectoryRelativeUrl,
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
