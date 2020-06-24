import { createBrowserRuntime } from "../runtime/createBrowserRuntime/createBrowserRuntime.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { memoize } from "../memoize.js"

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
  const executionResult = {}
  const fileExecutionResultPromises = []
  Object.keys(fileExecutionMap).forEach((key) => {
    executionResult[key] = null // to get always same order for Object.keys(executionResult)
    const fileExecutionResultPromise = fileExecutionMap[key]
    fileExecutionResultPromises.push(fileExecutionResultPromise)
    fileExecutionResultPromise.then((fileExecutionResult) => {
      executionResult[key] = fileExecutionResult
    })
  })
  await Promise.all(fileExecutionResultPromises)
  return executionResult
})

const importFile = async (specifier) => {
  // si on a déja importer ce fichier ??
  // if (specifier in fileExecutionMap) {

  // }

  const fileExecutionResultPromise = (async () => {
    const browserRuntime = await getBrowserRuntime()
    const executionResult = await browserRuntime.executeFile(specifier, {
      collectCoverage: true,
      collectNamespace: true,
    })
    return executionResult
  })()

  fileExecutionMap[specifier] = fileExecutionResultPromise
  return fileExecutionResultPromise
}

const getBrowserRuntime = memoize(async () => {
  const compileServerOrigin = document.location.origin
  const compileServerInfoResponse = await fetchUsingXHR(compileServerOrigin, {
    headers: {
      "x-jsenv-exploring": true,
    },
  })
  const { outDirectoryRelativeUrl } = await compileServerInfoResponse.json()
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
  return browserRuntime
})

window.__jsenv__ = {
  executionResultPromise,
  importFile,
}
