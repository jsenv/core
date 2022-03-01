import { normalizeImportMap } from "@jsenv/importmap/src/normalizeImportMap.js"

// do not use memoize from @jsenv/filesystem to avoid pulling @jsenv/filesystem code into the browser build
import { fetchUrl } from "@jsenv/core/src/internal/browser_utils/fetch_browser.js"
import { createImportResolverForImportmap } from "@jsenv/core/src/internal/import_resolution/import_resolver_importmap.js"

import { createBrowserSystem } from "./browser_system.js"

export const createBrowserClient = async () => {
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
    importMap,
    importMapUrl,
  })
  const browserSystem = await createBrowserSystem({
    fetchSource,
    importResolver,
  })
  return browserSystem
}

const fetchSource = (url, { contentTypeExpected }) => {
  return fetchUrl(url, {
    credentials: "same-origin",
    contentTypeExpected,
  })
}
