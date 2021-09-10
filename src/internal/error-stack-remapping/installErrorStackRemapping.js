import { createDetailedMessage } from "@jsenv/logger"
import { stackToString } from "./stackToString.js"
import { getOriginalCallsites } from "./getOriginalCallsites.js"

export const installErrorStackRemapping = ({
  fetchFile,
  resolveFile,
  SourceMapConsumer,
  indent = "  ",
}) => {
  if (typeof fetchFile !== "function") {
    throw new TypeError(`fetchFile must be a function, got ${fetchFile}`)
  }
  if (typeof SourceMapConsumer !== "function") {
    throw new TypeError(
      `sourceMapConsumer must be a function, got ${SourceMapConsumer}`,
    )
  }
  if (typeof indent !== "string") {
    throw new TypeError(`indent must be a string, got ${indent}`)
  }

  const errorRemappingCache = new WeakMap()
  const errorRemapFailureCallbackMap = new WeakMap()

  let installed = false
  const previousPrepareStackTrace = Error.prepareStackTrace
  const install = () => {
    if (installed) return
    installed = true
    Error.prepareStackTrace = prepareStackTrace
  }

  const uninstall = () => {
    if (!installed) return
    installed = false
    Error.prepareStackTrace = previousPrepareStackTrace
  }

  // ensure we do not use prepareStackTrace for thoose error
  // otherwise we would recursively remap error stack
  // and if the reason causing the failure is still here
  // it would create an infinite loop
  const readErrorStack = (error) => {
    uninstall()
    const stack = error.stack
    install()
    return stack
  }

  const prepareStackTrace = (error, stack) => {
    const onFailure = (failureData) => {
      const failureCallbackArray = errorRemapFailureCallbackMap.get(error)
      if (failureCallbackArray) {
        failureCallbackArray.forEach((callback) => callback(failureData))
      }
    }

    const stackRemappingPromise = getOriginalCallsites({
      stack,
      error,
      resolveFile,
      fetchFile: memoizeFetch(fetchFile),
      SourceMapConsumer,
      readErrorStack,
      indent,
      onFailure,
    })
    errorRemappingCache.set(error, stackRemappingPromise)

    return stackToString(stack, { error, indent })
  }

  const getErrorOriginalStackString = async (
    error,
    {
      onFailure = (message) => {
        console.warn(message)
      },
    } = {},
  ) => {
    if (onFailure) {
      const remapFailureCallbackArray = errorRemapFailureCallbackMap.get(error)
      if (remapFailureCallbackArray) {
        errorRemapFailureCallbackMap.set(error, [
          ...remapFailureCallbackArray,
          onFailure,
        ])
      } else {
        errorRemapFailureCallbackMap.set(error, [onFailure])
      }
    }

    // ensure Error.prepareStackTrace gets triggered by reading error.stack now
    const { stack } = error
    const promise = errorRemappingCache.get(error)

    if (promise) {
      try {
        const originalCallsites = await promise
        errorRemapFailureCallbackMap.get(error)

        const firstCall = originalCallsites[0]
        if (firstCall) {
          Object.assign(error, {
            filename: firstCall.getFileName(),
            lineno: firstCall.getLineNumber(),
            columnno: firstCall.getColumnNumber(),
          })
        }
        return stackToString(originalCallsites, { error, indent })
      } catch (e) {
        onFailure(
          createDetailedMessage(`error while computing original stack.`, {
            ["stack from error while computing"]: readErrorStack(e),
            ["stack from error to remap"]: stack,
          }),
        )
        return stack
      }
    }

    return stack
  }

  install()

  return { getErrorOriginalStackString, uninstall }
}

const memoizeFetch = (fetchUrl) => {
  const urlCache = {}
  return async (url) => {
    if (url in urlCache) {
      return urlCache[url]
    }
    const responsePromise = fetchUrl(url)
    urlCache[url] = responsePromise
    return responsePromise
  }
}
