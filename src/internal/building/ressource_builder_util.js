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

export const compareContentType = (leftContentType, rightContentType) => {
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
  const { ressourceContentTypeExpected } = reference
  const { contentType } = reference.ressource

  if (!ressourceContentTypeExpected) {
    return
  }

  if (compareContentType(ressourceContentTypeExpected, contentType)) {
    return
  }

  // sourcemap content type is fine if we got octet-stream too
  const { ressource } = reference
  if (
    ressourceContentTypeExpected === "application/json" &&
    contentType === "application/octet-stream" &&
    ressource.url.endsWith(".map")
  ) {
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
  const { ressourceContentTypeExpected, ressource } = reference
  const { contentType, url } = ressource

  return createDetailedMessage(
    `A reference was expecting ${ressourceContentTypeExpected} but found ${contentType} instead.`,
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
}) => {
  const { isRessourceHint } = reference

  if (isRessourceHint) {
    return formatFoundRessourceHint({
      reference,
      showReferenceSourceLocation,
      referenceEffects,
    })
  }

  const { ressource } = reference
  const { isEntryPoint } = ressource

  if (isEntryPoint) {
    return formatCreateReferenceForEntry({
      reference,
      showReferenceSourceLocation,
      referenceEffects,
    })
  }

  const { isExternal } = ressource

  if (isExternal) {
    return formatFoundReferenceToExternalRessource({
      reference,
      showReferenceSourceLocation,
      referenceEffects,
    })
  }

  const { isInline, isJsModule } = ressource
  if (isInline && !isJsModule) {
    return formatFoundReferenceToInlineAsset({
      reference,
      showReferenceSourceLocation,
      referenceEffects,
    })
  }

  if (isInline && isJsModule) {
    return formatFoundReferenceToInlineModule({
      reference,
      showReferenceSourceLocation,
      referenceEffects,
    })
  }

  if (!isJsModule) {
    return formatFoundReferenceToAsset({
      reference,
      showReferenceSourceLocation,
      referenceEffects,
    })
  }

  return formatFoundReferenceToModule({
    reference,
    showReferenceSourceLocation,
    referenceEffects,
  })
}

const formatCreateReferenceForEntry = ({ reference, referenceEffects }) => {
  return `
Start from entry file ${
    reference.ressource.ressourceRelativeUrl
  }${appendEffects(referenceEffects)}`
}

const formatFoundRessourceHint = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
}) => {
  return `
Found ressource hint in ${showReferenceSourceLocation(
    reference,
  )}${appendEffects(referenceEffects)}`
}

const formatFoundReferenceToExternalRessource = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
}) => {
  return `
Found reference to an external url in ${showReferenceSourceLocation(
    reference,
  )}${appendEffects(referenceEffects)}`
}

const formatFoundReferenceToInlineAsset = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
}) => {
  return `
Found reference to an inline asset in ${showReferenceSourceLocation(
    reference,
  )}${appendEffects(referenceEffects)}`
}

const formatFoundReferenceToInlineModule = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
}) => {
  return `
Found reference to an inline module in ${showReferenceSourceLocation(
    reference,
  )}${appendEffects(referenceEffects)}`
}

const formatFoundReferenceToAsset = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
}) => {
  return `
Found reference to an asset in ${showReferenceSourceLocation(
    reference,
  )}${appendEffects(referenceEffects)}`
}

const formatFoundReferenceToModule = ({
  reference,
  showReferenceSourceLocation,
  referenceEffects,
}) => {
  return `
Found reference to a module in ${showReferenceSourceLocation(
    reference,
  )}${appendEffects(referenceEffects)}`
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
