import { isFileSystemPath, fileSystemPathToUrl } from "@jsenv/util"
import { createDetailedMessage } from "@jsenv/logger"
import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"

export const getTargetAsBase64Url = ({ targetBuildBuffer, targetContentType }) => {
  return stringifyDataUrl({
    data: targetBuildBuffer,
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

  if (!referenceExpectedContentType) {
    return
  }

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

  return createDetailedMessage(
    `A reference was expecting ${referenceExpectedContentType} but found ${targetContentType} instead.`,
    {
      ["reference"]: showReferenceSourceLocation(reference),
      ["target url"]: targetUrl,
    },
  )
}

export const formatFoundReference = ({
  reference,
  showReferenceSourceLocation,
  referenceEffect,
}) => {
  const { target } = reference
  const { targetIsExternal } = target

  if (targetIsExternal) {
    return formatFoundReferenceToExternalRessource({
      reference,
      showReferenceSourceLocation,
    })
  }

  const { targetIsInline, targetIsJsModule } = target
  if (targetIsInline && !targetIsJsModule) {
    return formatFoundReferenceToInlineAsset({
      reference,
      showReferenceSourceLocation,
    })
  }

  if (targetIsInline && targetIsJsModule) {
    return formatFoundReferenceToInlineModule({
      reference,
      showReferenceSourceLocation,
    })
  }

  if (!targetIsJsModule) {
    return formatFoundReferenceToAsset({
      reference,
      showReferenceSourceLocation,
      referenceEffect,
    })
  }

  return formatFoundReferenceToModule({
    reference,
    showReferenceSourceLocation,
    referenceEffect,
  })
}

const formatFoundReferenceToExternalRessource = ({ reference, showReferenceSourceLocation }) => {
  return `
${createDetailedMessage(`Found reference to an external url
${showReferenceSourceLocation(reference)}`)}`
}

const formatFoundReferenceToInlineAsset = ({ reference, showReferenceSourceLocation }) => {
  return `
${createDetailedMessage(`Found reference to an inline ressource
${showReferenceSourceLocation(reference)}`)}`
}

const formatFoundReferenceToInlineModule = ({ reference, showReferenceSourceLocation }) => {
  return `
${createDetailedMessage(`Found reference to an inline module
${showReferenceSourceLocation(reference)}`)}`
}

const formatFoundReferenceToAsset = ({
  reference,
  showReferenceSourceLocation,
  referenceEffect,
}) => {
  return `
${createDetailedMessage(
  `Found reference to an asset
${showReferenceSourceLocation(reference)}`,
  {
    ...(referenceEffect
      ? {
          effect: `emit rollup asset ${referenceEffect.payload}`,
        }
      : {}),
  },
)}
`
}

const formatFoundReferenceToModule = ({
  reference,
  showReferenceSourceLocation,
  referenceEffect,
}) => {
  return `
${createDetailedMessage(
  `Found reference to a module
${showReferenceSourceLocation(reference)}`,
  {
    ...(referenceEffect
      ? {
          effect: `emit rollup chunk ${referenceEffect.payload}`,
        }
      : {}),
  },
)}
`
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
