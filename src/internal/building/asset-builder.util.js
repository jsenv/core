import { isFileSystemPath, fileSystemPathToUrl } from "@jsenv/util"
import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"

export const getTargetAsBase64Url = ({ sourceAfterTransformation, content }) => {
  return stringifyDataUrl({
    data: sourceAfterTransformation,
    base64Flag: true,
    mediaType: content.type,
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

  logger.warn(formatContentTypeMismatchLog(reference, { showReferenceSourceLocation }))
}

const formatContentTypeMismatchLog = (reference, { showReferenceSourceLocation }) => {
  return `A reference was expecting ${reference.contentType} but found ${
    reference.target.content.type
  } instead.
--- reference ---
${showReferenceSourceLocation(reference)}
--- target url ---
${reference.target.url}`
}

export const formatExternalReferenceLog = (
  reference,
  { showReferenceSourceLocation, projectDirectoryUrl },
) => {
  return `Found reference to an url outside project directory.
${showReferenceSourceLocation(reference)}
--- target url ---
${reference.target.url}
--- project directory url ---
${projectDirectoryUrl}`
}

export const formatReferenceFound = (reference, { showReferenceSourceLocation }) => {
  const { target } = reference

  let message

  if (target.isInline && target.isJsModule) {
    message = `found inline js module.`
  } else if (target.isInline) {
    message = `found inline asset.`
  } else if (target.isJsModule) {
    message = `found js module reference to ${target.relativeUrl}.`
  } else {
    message = `found asset reference to ${target.relativeUrl}.`
  }

  message += `
${showReferenceSourceLocation(reference)}
`

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
