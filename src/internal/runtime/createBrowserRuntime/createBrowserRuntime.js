import { normalizeImportMap } from "@jsenv/import-map/src/normalizeImportMap.js"
import { uneval } from "@jsenv/uneval"
// do not use memoize from @jsenv/util to avoid pulling @jsenv/util code into the browser bundle
import { memoize } from "../../memoize.js"
import { createBrowserSystem } from "./createBrowserSystem.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"
import { fetchUrl } from "../../fetch-browser.js"

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
        ...(htmlFileRelativeUrl ? { "x-jsenv-execution-id": htmlFileRelativeUrl } : {}),
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

  // if there is an importmap in the document we should use it instead of fetching like this.
  // systemjs style with systemjs-importmap
  const importmapScript = document.querySelector(`script[type="jsenv-importmap"]`)
  let importMap
  if (importmapScript) {
    let importmapRaw
    let importmapFileUrl
    if (importmapScript.src) {
      importmapFileUrl = importmapScript.src
      const importmapFileResponse = await fetchSource(importmapFileUrl)
      importmapRaw = importmapFileResponse.status === 404 ? {} : await importmapFileResponse.json()
    } else {
      importmapFileUrl = document.location.href
      importmapRaw = JSON.parse(importmapScript.textContent) || {}
    }
    importMap = normalizeImportMap(importmapRaw, importmapFileUrl)
  }

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      outDirectoryRelativeUrl,
      importMap,
      importDefaultExtension,
      fetchSource,
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
    } = {},
  ) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      outDirectoryRelativeUrl,
      importMap,
      importDefaultExtension,
      fetchSource,
    })

    let executionResult
    try {
      let namespace = await browserSystem.import(specifier)

      if (transferableNamespace) {
        namespace = makeNamespaceTransferable(namespace)
      }

      executionResult = {
        status: "completed",
        namespace,
        coverageMap: readCoverage(),
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
        coverageMap: readCoverage(),
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

const makeNamespaceTransferable = (namespace) => {
  const transferableNamespace = {}
  Object.keys(namespace).forEach((key) => {
    const value = namespace[key]
    transferableNamespace[key] = isTransferable(value) ? value : hideNonTransferableValue(value)
  })
  return transferableNamespace
}

const hideNonTransferableValue = (value) => {
  if (typeof value === "function") {
    return `[[HIDDEN: ${value.name} function cannot be transfered]]`
  }

  if (typeof value === "symbol") {
    return `[[HIDDEN: symbol function cannot be transfered]]`
  }

  return `[[HIDDEN: ${value.constructor ? value.constructor.name : "object"} cannot be transfered]]`
}

// https://stackoverflow.com/a/32673910/2634179
const isTransferable = (value) => {
  const seenArray = []
  const visit = () => {
    if (typeof value === "function") return false

    if (typeof value === "symbol") return false

    if (value === null) return false

    if (typeof value === "object") {
      const constructorName = value.constructor.namespace

      if (supportedTypes.includes(constructorName)) {
        return true
      }

      const maybe = maybeTypes.includes(constructorName)
      if (maybe) {
        const visited = seenArray.includes(value)
        if (visited) {
          // we don't really know until we are done visiting the object
          // implementing it properly means waiting for the recursion to be done
          // let's just
          return true
        }
        seenArray.push(value)

        if (constructorName === "Array" || constructorName === "Object") {
          return Object.keys(value).every((key) => isTransferable(value[key]))
        }
        if (constructorName === "Map") {
          return (
            [...value.keys()].every(isTransferable) && [...value.values()].every(isTransferable)
          )
        }
        if (constructorName === "Set") {
          return [...value.keys()].every(isTransferable)
        }
      }

      // Error, DOM Node and others
      return false
    }
    return true
  }

  return visit(value)
}

const supportedTypes = [
  "Boolean",
  "Number",
  "String",
  "Date",
  "RegExp",
  "Blob",
  "FileList",
  "ImageData",
  "ImageBitmap",
  "ArrayBuffer",
]

const maybeTypes = ["Array", "Object", "Map", "Set"]

const unevalException = (value) => {
  return uneval(value)
}

const readCoverage = () => window.__coverage__

const displayErrorInConsole = (error) => {
  console.error(error)
}
