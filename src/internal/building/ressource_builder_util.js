import { isFileSystemPath, fileSystemPathToUrl } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"

export const getRessourceAsBase64Url = ({ bufferAfterBuild, contentType }) => {
  return stringifyDataUrl({
    data: bufferAfterBuild,
    base64Flag: true,
    mediaType: contentType,
  })
}

export const isReferencedOnlyByRessourceHint = (ressource) => {
  return ressource.references.every((reference) => {
    return reference.isRessourceHint
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
    url:
      fileName && isFileSystemPath(fileName)
        ? fileSystemPathToUrl(fileName)
        : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  }
}

const compareContentType = (leftContentType, rightContentType) => {
  if (leftContentType === rightContentType) {
    return true
  }
  if (
    leftContentType === "text/javascript" &&
    rightContentType === "application/javascript"
  ) {
    return true
  }
  if (
    leftContentType === "application/javascript" &&
    rightContentType === "text/javascript"
  ) {
    return true
  }
  return false
}

export const checkContentType = (
  reference,
  { logger, showReferenceSourceLocation },
) => {
  const { contentTypeExpected } = reference
  const { contentType } = reference.ressource

  if (!contentTypeExpected) {
    return
  }

  const contentTypeIsOk = Array.isArray(contentTypeExpected)
    ? contentTypeExpected.some((allowedContentType) => {
        return compareContentType(allowedContentType, contentType)
      })
    : compareContentType(contentTypeExpected, contentType)

  if (contentTypeIsOk) {
    return
  }

  logger.warn(
    formatContentTypeMismatchLog(reference, {
      showReferenceSourceLocation,
    }),
  )
}

const formatContentTypeMismatchLog = (
  reference,
  { showReferenceSourceLocation },
) => {
  const { contentTypeExpected, ressource } = reference
  const { contentType, url } = ressource

  return createDetailedMessage(
    `A reference was expecting ${contentTypeExpected} but found ${contentType} instead.`,
    {
      ["reference"]: showReferenceSourceLocation(reference),
      ["ressource url"]: url,
    },
  )
}

export const formatFoundReference = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
  shortenUrl,
}) => {
  const { ressource } = reference
  const { isEntryPoint } = ressource
  if (isEntryPoint) {
    return `
Start from entry file ${reference.ressource.relativeUrl}${appendEffects(
      referenceEffects,
    )}`
  }

  const { isPlaceholder } = ressource
  if (isPlaceholder) {
    return `
Create placeholder for ${showReferenceSourceLocation(reference)}${appendEffects(
      referenceEffects,
    )}`
  }

  const { referenceLabel = "unlabelled reference" } = reference
  return `
Found "${referenceLabel}" referencing "${shortenUrl(reference.ressource.url)}"
  in ${showReferenceSourceLocation(reference)}${appendEffects(
    referenceEffects,
  )}`
}

const appendEffects = (effects) => {
  return effects.length === 0
    ? ``
    : `
-> ${effects.join(`
-> `)}`
}

export const formatDependenciesCollectedMessage = ({
  ressource,
  shortenUrl,
}) => {
  return createDetailedMessage(
    `
Dependencies collected for ${shortenUrl(ressource.url)}`,
    {
      dependencies: ressource.dependencies.map((dependencyReference) =>
        shortenUrl(dependencyReference.ressource.url),
      ),
    },
  )
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
