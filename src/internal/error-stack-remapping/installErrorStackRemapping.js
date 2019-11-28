import { stackToString } from "./stackToString.js"
import { generateOriginalStackString } from "./getOriginalStackString.js"

export const installErrorStackRemapping = ({
  resolveHref,
  fetchHref,
  SourceMapConsumer,
  base64ToString,
  indent = "  ",
}) => {
  if (typeof resolveHref !== "function") {
    throw new TypeError(`resolveHref must be a function, got ${resolveHref}`)
  }
  if (typeof fetchHref !== "function") {
    throw new TypeError(`fetchHref must be a function, got ${fetchHref}`)
  }
  if (typeof base64ToString !== "function") {
    throw new TypeError(`base64ToString must be a function, got ${base64ToString}`)
  }
  if (typeof SourceMapConsumer !== "function") {
    throw new TypeError(`sourceMapConsumer must be a function, got ${SourceMapConsumer}`)
  }
  if (typeof indent !== "string") {
    throw new TypeError(`indent must be a string, got ${indent}`)
  }

  const errorOriginalStackStringCache = new WeakMap()
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

    const originalStackStringPromise = generateOriginalStackString({
      stack,
      error,
      resolveHref,
      fetchHref: memoizeFetch(fetchHref),
      SourceMapConsumer,
      base64ToString,
      readErrorStack,
      indent,
      onFailure,
    })
    errorOriginalStackStringCache.set(error, originalStackStringPromise)

    return stackToString({ stack, error, indent })
  }

  const getErrorOriginalStackString = async (
    error,
    {
      onFailure = ({ message }) => {
        console.warn(message)
      },
    } = {},
  ) => {
    if (onFailure) {
      const remapFailureCallbackArray = errorRemapFailureCallbackMap.get(error)
      if (remapFailureCallbackArray) {
        errorRemapFailureCallbackMap.set(error, [...remapFailureCallbackArray, onFailure])
      } else {
        errorRemapFailureCallbackMap.set(error, [onFailure])
      }
    }

    // ensure Error.prepareStackTrace gets triggered by reading error.stack now
    const { stack } = error
    const promise = errorOriginalStackStringCache.get(error)

    if (promise) {
      const originalStack = await promise
      errorRemapFailureCallbackMap.get(error)
      return originalStack
    }

    return stack
  }

  install()

  return { getErrorOriginalStackString, uninstall }
}

const memoizeFetch = (fetchHref) => {
  const hrefCache = {}
  return async (href) => {
    if (href in hrefCache) {
      return hrefCache[href]
    }
    const responsePromise = fetchHref(href)
    hrefCache[href] = responsePromise
    return responsePromise
  }
}
