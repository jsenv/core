import { isFileSystemPath, fileSystemPathToUrl } from "@jsenv/util"
import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"

export const getTargetAsBase64Url = ({ targetBufferAfterTransformation, targetContentType }) => {
  return stringifyDataUrl({
    data: targetBufferAfterTransformation,
    base64Flag: true,
    mediaType: targetContentType,
  })
}

export const memoize = (fn) => {
  let called
  let previousCallReturnValue
  const memoized = (...args) => {
    if (called) return previousCallReturnValue
    previousCallReturnValue = fn(...args)
    called = true
    return previousCallReturnValue
  }
  memoized.forceMemoization = (value) => {
    called = true
    previousCallReturnValue = value
  }
  return memoized
}

export const getCallerLocation = () => {
  const { prepareStackTrace } = Error
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace
    return stack
  }

  const { stack } = new Error()
  const callerCallsite = stack[2]
  const fileName = callerCallsite.getFileName()
  return {
    url: fileName && isFileSystemPath(fileName) ? fileSystemPathToUrl(fileName) : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  }
}

export const compareContentType = (leftContentType, rightContentType) => {
  if (leftContentType === rightContentType) {
    return true
  }
  if (leftContentType === "text/javascript" && rightContentType === "application/javascript") {
    return true
  }
  if (leftContentType === "application/javascript" && rightContentType === "text/javascript") {
    return true
  }
  return false
}

export const checkContentType = (reference, { logger, showReferenceSourceLocation }) => {
  const { referenceExpectedContentType } = reference
  const { targetContentType } = reference.target

  if (compareContentType(referenceExpectedContentType, targetContentType)) {
    return
  }

  // sourcemap content type is fine if we got octet-stream too
  const { targetUrl } = reference.target
  if (
    referenceExpectedContentType === "application/json" &&
    targetContentType === "application/octet-stream" &&
    targetUrl.endsWith(".map")
  ) {
    return
  }

  logger.warn(
    formatContentTypeMismatchLog(reference, {
      showReferenceSourceLocation,
    }),
  )
}

const formatContentTypeMismatchLog = (reference, { showReferenceSourceLocation }) => {
  const { referenceExpectedContentType, target } = reference
  const { targetContentType, targetUrl } = target

  return `A reference was expecting ${referenceExpectedContentType} but found ${targetContentType} instead.
--- reference ---
${showReferenceSourceLocation(reference)}
--- target url ---
${targetUrl}`
}

export const formatExternalReferenceLog = (
  reference,
  { showReferenceSourceLocation, projectDirectoryUrl },
) => {
  const { target } = reference
  const { targetUrl } = target
  return `Found reference to an url outside project directory.
${showReferenceSourceLocation(reference)}
--- target url ---
${targetUrl}
--- project directory url ---
${projectDirectoryUrl}`
}

export const formatReferenceFound = (reference, referenceSourceLocation) => {
  const { target } = reference
  const { targetIsInline, targetIsJsModule, targetRelativeUrl } = target

  let message

  if (targetIsInline && targetIsJsModule) {
    message = `found inline js module.`
  } else if (targetIsInline) {
    message = `found inline asset.`
  } else if (targetIsJsModule) {
    message = `found js module reference to ${targetRelativeUrl}.`
  } else {
    message = `found asset reference to ${targetRelativeUrl}.`
  }

  message += `
--- reference source ---
${referenceSourceLocation}`

  return message
}

// const textualContentTypes = ["text/html", "text/css", "image/svg+xml"]
// const isTextualContentType = (contentType) => {
//   if (textualContentTypes.includes(contentType)) {
//     return true
//   }
//   if (contentType.startsWith("text/")) {
//     return true
//   }
//   return false
// }
