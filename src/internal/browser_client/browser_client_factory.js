import { normalizeImportMap } from "@jsenv/importmap/src/normalizeImportMap.js"

// do not use memoize from @jsenv/filesystem to avoid pulling @jsenv/filesystem code into the browser build
import { fetchUrl } from "@jsenv/core/src/internal/browser_utils/fetch_browser.js"
import { createImportResolverForImportmap } from "@jsenv/core/src/internal/import_resolution/import_resolver_importmap.js"
import { memoize } from "@jsenv/core/src/internal/memoize.js"
import { measureAsyncFnPerf } from "@jsenv/core/src/internal/perf_browser.js"

import { createBrowserSystem } from "./browser_system.js"
import { makeModuleNamespaceTransferable } from "./module_namespace_transfer.js"

const memoizedCreateBrowserSystem = memoize(createBrowserSystem)

export const createBrowserClient = async ({
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
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

  const compileServerMetaUrl = String(
    new URL("__jsenv_compile_profile__", `${compileServerOrigin}/`),
  )
  const { importDefaultExtension } = await fetchJson(compileServerMetaUrl)
  const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`
  // if there is an importmap in the document we use it instead of fetching.
  // systemjs style with systemjs-importmap
  const importmapScript = document.querySelector(
    `script[type="systemjs-importmap"]`,
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
          namespace = makeModuleNamespaceTransferable(namespace)
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
