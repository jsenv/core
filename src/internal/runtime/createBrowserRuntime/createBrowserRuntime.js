import { normalizeImportMap } from "@jsenv/importmap/src/normalizeImportMap.js"

// do not use memoize from @jsenv/filesystem to avoid pulling @jsenv/filesystem code into the browser build
import { memoize } from "../../memoize.js"
import { fetchUrl } from "../../browser-utils/fetch-browser.js"
import { createImportResolverForImportmap } from "../../import-resolution/import-resolver-importmap.js"
import { measureAsyncFnPerf } from "../../perf_browser.js"

import { createBrowserSystem } from "./createBrowserSystem.js"
import { makeNamespaceTransferable } from "./makeNamespaceTransferable.js"

const memoizedCreateBrowserSystem = memoize(createBrowserSystem)

export const createBrowserRuntime = async ({
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileId,
}) => {
  const fetchSource = (url, { contentTypeExpected }) => {
    return fetchUrl(url, {
      credentials: "same-origin",
      contentTypeExpected,
    })
  }

  const fetchJson = async (url) => {
    const response = await fetchSource(url, {
      contentTypeExpected: "application/json",
    })
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
      const importmapFileResponse = await fetchSource(importMapUrl, {
        contentTypeExpected: "application/importmap+json",
      })
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

        return {
          status: "errored",
          error: transformedError,
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
