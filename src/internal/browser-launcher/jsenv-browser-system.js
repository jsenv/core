import { createBrowserRuntime } from "../runtime/createBrowserRuntime/createBrowserRuntime.js"
import { installBrowserErrorStackRemapping } from "../error-stack-remapping/installBrowserErrorStackRemapping.js"
import { fetchUrl } from "../fetch-browser.js"
import { fetchAndEvalUsingFetch } from "../fetchAndEvalUsingFetch.js"
import { memoize } from "../memoize.js"

const getNavigationStartTime = () => {
  try {
    return window.performance.timing.navigationStart
  } catch (e) {
    return Date.now()
  }
}

const navigationStartTime = getNavigationStartTime()

const readyPromise = new Promise((resolve) => {
  if (document.readyState === "complete") {
    resolve()
  } else {
    const loadCallback = () => {
      window.removeEventListener("load", loadCallback)
      resolve()
    }
    window.addEventListener("load", loadCallback)
  }
})

const fileExecutionMap = {}

const executionResultPromise = readyPromise.then(async () => {
  const fileExecutionResultMap = {}
  const fileExecutionResultPromises = []
  let status = "completed"
  let exceptionSource = ""
  Object.keys(fileExecutionMap).forEach((key) => {
    fileExecutionResultMap[key] = null // to get always same order for Object.keys(executionResult)
    const fileExecutionResultPromise = fileExecutionMap[key]
    fileExecutionResultPromises.push(fileExecutionResultPromise)
    fileExecutionResultPromise.then((fileExecutionResult) => {
      fileExecutionResultMap[key] = fileExecutionResult
      if (fileExecutionResult.status === "errored") {
        status = "errored"
        exceptionSource = fileExecutionResult.exceptionSource
      }
    })
  })
  await Promise.all(fileExecutionResultPromises)

  return {
    status,
    ...(status === "errored" ? { exceptionSource } : {}),
    startTime: navigationStartTime,
    endTime: Date.now(),
    fileExecutionResultMap,
  }
})

const importFile = (specifier) => {
  // si on a déja importer ce fichier ??
  // if (specifier in fileExecutionMap) {

  // }

  const fileExecutionResultPromise = (async () => {
    const browserRuntime = await getBrowserRuntime()
    const executionResult = await browserRuntime.executeFile(specifier, {})
    return executionResult
  })()

  fileExecutionMap[specifier] = fileExecutionResultPromise
  return fileExecutionResultPromise
}

const getBrowserRuntime = memoize(async () => {
  const compileServerOrigin = document.location.origin
  const exploringInfoResponse = await fetchUrl(compileServerOrigin, {
    headers: {
      "x-jsenv-exploring": true,
    },
  })
  const exploringData = await exploringInfoResponse.json()
  const { outDirectoryRelativeUrl } = exploringData
  const outDirectoryUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const afterOutDirectory = document.location.href.slice(outDirectoryUrl.length)
  const parts = afterOutDirectory.split("/")
  const compileId = parts[0]
  const remaining = parts.slice(1).join("/")
  const htmlFileRelativeUrl = remaining

  const browserRuntime = await createBrowserRuntime({
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileId,
    htmlFileRelativeUrl,
  })

  if (Error.captureStackTrace) {
    const { sourcemapMainFileRelativeUrl, sourcemapMappingFileRelativeUrl } = exploringData

    await fetchAndEvalUsingFetch(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
    const { SourceMapConsumer } = window.sourceMap
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
      SourceMapConsumer,
    })

    const errorTransform = async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error
      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    }

    const executeFile = browserRuntime.executeFile
    browserRuntime.executeFile = (file, options = {}) => {
      return executeFile(file, { errorTransform, ...options })
    }
  }

  return browserRuntime
})

window.__jsenv__ = {
  executionResultPromise,
  importFile,
}
