import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"

import { unevalException } from "../../unevalException.js"
// do not use memoize from @jsenv/filesystem to avoid pulling @jsenv/filesystem code into the browser build
import { memoize } from "../../memoize.js"
import { fetchUrl } from "../../browser-utils/fetch-browser.js"
import { createImportResolverForImportmap } from "../../import-resolution/import-resolver-importmap.js"
import { measureAsyncFnPerf } from "../../perf_browser.js"

import { createBrowserSystem } from "./createBrowserSystem.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"
import { makeNamespaceTransferable } from "./makeNamespaceTransferable.js"

const memoizedCreateBrowserSystem = memoize(createBrowserSystem)

export const createBrowserRuntime = async ({
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileId,
  htmlFileRelativeUrl,
}) => {
  const fetchSource = (url) => {
    return fetchUrl(url, {
      credentials: "include",
      headers: {
        ...(htmlFileRelativeUrl
          ? { "x-jsenv-execution-id": htmlFileRelativeUrl }
          : {}),
      },
    })
  }

  const fetchJson = async (url) => {
    const response = await fetchSource(url)
    const json = await response.json()
    return json
  }

  const outDirectoryUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const envUrl = String(new URL("env.json", outDirectoryUrl))
  const { importDefaultExtension } = await fetchJson(envUrl)
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`
  // if there is an importmap in the document we use it instead of fetching.
  // systemjs style with systemjs-importmap
  const importmapScript = document.querySelector(
    `script[type="jsenv-importmap"]`,
  )
  let importMap
  let importMapUrl
  if (importmapScript) {
    let importmapRaw
    if (importmapScript.src) {
      importMapUrl = importmapScript.src
      const importmapFileResponse = await fetchSource(importMapUrl)
      importmapRaw =
        importmapFileResponse.status === 404
          ? {}
          : await importmapFileResponse.json()
    } else {
      importMapUrl = document.location.href
      importmapRaw = JSON.parse(importmapScript.textContent) || {}
    }
    importMap = normalizeImportMap(importmapRaw, importMapUrl)
  }

  const importResolver = await createImportResolverForImportmap({
    // projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    importMap,
    importMapUrl,
    importDefaultExtension,
  })

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      importResolver,
    })
    return browserSystem.import(specifier)
  }

  const executeFile = async (
    specifier,
    {
      transferableNamespace = false,
      errorExposureInConsole = true,
      errorExposureInNotification = false,
      errorExposureInDocument = true,
      executionExposureOnWindow = false,
      errorTransform = (error) => error,
      measurePerformance,
    } = {},
  ) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      fetchSource,
      importResolver,
    })

    const importUsingSystemJs = async () => {
      try {
        let namespace = await browserSystem.import(specifier)

        if (transferableNamespace) {
          namespace = makeNamespaceTransferable(namespace)
        }

        return {
          status: "completed",
          namespace,
          coverage: readCoverage(),
        }
      } catch (error) {
        let transformedError
        try {
          transformedError = await errorTransform(error)
        } catch (e) {
          transformedError = error
        }

        if (errorExposureInConsole) {
          displayErrorInConsole(transformedError)
        }
        if (errorExposureInNotification) {
          displayErrorNotification(transformedError)
        }
        if (errorExposureInDocument) {
          displayErrorInDocument(transformedError)
        }

        return {
          status: "errored",
          exceptionSource: unevalException(transformedError),
          coverage: readCoverage(),
        }
      }
    }

    const executionResult = await (measurePerformance
      ? measureAsyncFnPerf(importUsingSystemJs, `jsenv_file_import`)
      : importUsingSystemJs())
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

const readCoverage = () => window.__coverage__

const displayErrorInConsole = (error) => {
  console.error(error)
}
