/**

--- Inlining asset ---
In the context of http2 and beyond http request
is reused so saving http request by inlining asset is less
attractive.
You gain some speed because one big file is still faster
than many small files.

But inlined asset got two drawbacks:

(1) they cannot be cached by the browser
assets inlined in the html file have no hash
and must be redownloaded every time.
-> No way to mitigate this

(2) they cannot be shared by different files.
assets inlined in the html cannot be shared
because their source lives in the html.
You might accidentatly load twice a css because it's
referenced both in js and html for instance.
-> We could warn about asset inlined + referenced
more than once

Each time an asset needs to be inlined its dependencies
must be re-resolved to its importer location.
This is quite a lot of work to implement this.
Considering that inlining is not that worth it and might
duplicate them when imported more than once let's just not do it.

*/

import { urlToContentType } from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  isFileSystemPath,
  fileSystemPathToUrl,
  urlToParentUrl,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { parseDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"
import { computeBuildRelativeUrl } from "./computeBuildRelativeUrl.js"
import { showSourceLocation } from "./showSourceLocation.js"
import { getTargetAsBase64Url } from "./getTargetAsBase64Url.js"

export const createCompositeAssetHandler = (
  { fetch, parse },
  {
    logLevel,
    format,
    projectDirectoryUrl, // project url but it can be an http url
    buildDirectoryRelativeUrl,
    urlToFileUrl, // get a file url from an eventual http url
    loadUrl = () => null,
    emitAsset,
    connectTarget = () => {},
    resolveTargetUrl = ({ specifier }, target) => resolveUrl(specifier, target.url),
  },
) => {
  const logger = createLogger({ logLevel })

  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)

  const createReferenceForAssetEntry = async (
    entryUrl,
    { entryContentType, entryBuildRelativeUrl, entrySource },
  ) => {
    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation()
    const entryReference = createReference({
      referenceInfo: {
        ...callerLocation,
        contentType: entryContentType,
      },
      targetInfo: {
        isEntry: true,
        disableHash: true,
        // don't hash asset entry points
        fileNamePattern: entryBuildRelativeUrl,
        url: entryUrl,
        ...(entrySource
          ? {
              content: {
                type: entryContentType,
                value: entrySource,
              },
            }
          : {}),
      },
    })

    await entryReference.target.getDependenciesAvailablePromise()
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    entryReference.target.getReadyPromise()
  }

  const createReferenceForAsset = async (url, { contentType, importerUrl, source }) => {
    const reference = createReference({
      referenceInfo: {
        url: importerUrl,
        column: undefined,
        line: undefined,
        contentType,
      },
      targetInfo: {
        url,
        ...(source
          ? {
              content: {
                type: contentType,
                value: source,
              },
            }
          : {}),
      },
    })

    logger.debug(formatReferenceFound(reference, { showReferenceSourceLocation }))
    await reference.target.getRollupReferenceIdAvailablePromise()
    return reference
  }

  const getAllAssetEntryEmittedPromise = async () => {
    const urlToWait = Object.keys(targetMap).filter((url) => targetMap[url].isEntry)
    return Promise.all(
      urlToWait.map(async (url) => {
        const target = targetMap[url]
        await target.getRollupReferenceIdAvailablePromise()
        return target
      }),
    )
  }

  const targetMap = {}
  const createReference = ({ referenceInfo, targetInfo }) => {
    const reference = { ...referenceInfo }

    const { url } = target
    if (url in targetMap) {
      const target = targetMap[url]
      connectReferenceAndTarget(reference, target)
      return reference
    }

    const target = createTarget(targetInfo)
    targetMap[url] = target
    connectReferenceAndTarget(reference, target)
    connectTarget(target)
    return reference
  }

  const connectReferenceAndTarget = (reference, target) => {
    reference.target = target
    target.importers.push(reference)
    target.getContentAvailablePromise().then(() => {
      const expectedContentType = reference.contentType
      const actualContentType = target.content.type
      if (!compareContentType(expectedContentType, actualContentType)) {
        // sourcemap content type is fine if we got octet-stream too
        if (
          expectedContentType === "application/json" &&
          actualContentType === "application/octet-stream" &&
          target.url.endsWith(".map")
        ) {
          return
        }
        logger.warn(formatContentTypeMismatchLog(reference, { showReferenceSourceLocation }))
      }
    })
  }

  const assetTransformMap = {}
  // used to remove sourcemap files that are renamed after they are emitted
  const buildRelativeUrlsToClean = []
  const getBuildRelativeUrlsToClean = () => buildRelativeUrlsToClean

  const createTarget = ({
    url,
    isEntry = false,
    isJsModule = false,
    isInline = false,
    disableHash = false,
    content,
    sourceAfterTransformation,
    fileNamePattern,
    importers = [],
  }) => {
    const target = {
      url,
      relativeUrl: urlToRelativeUrl(url, projectDirectoryUrl),
      isEntry,
      isJsModule,
      isInline,
      disableHash,
      content,
      sourceAfterTransformation,
      fileNamePattern,
      importers,
    }

    const getContentAvailablePromise = memoize(async () => {
      const response = await fetch(url, showReferenceSourceLocation(importers[0]))
      const responseContentTypeHeader = response.headers["content-type"] || ""
      const responseBodyAsArrayBuffer = await response.arrayBuffer()
      target.content = {
        type: responseContentTypeHeader,
        value: Buffer.from(responseBodyAsArrayBuffer),
      }
    })
    if (content !== undefined) {
      getContentAvailablePromise.forceMemoization(Promise.resolve())
    }

    const getDependenciesAvailablePromise = memoize(async () => {
      await getContentAvailablePromise()
      const dependencies = []

      let previousJsDependency
      let parsingDone = false
      const notifyDependencyFound = ({
        isJsModule = false,
        disableHash = false,
        contentType,
        specifier,
        line,
        column,
        content,
        fileNamePattern,
      }) => {
        if (parsingDone) {
          throw new Error(`notifyDependencyFound cannot be called once ${url} parsing is done.`)
        }

        let isInline = typeof content !== "undefined"
        const resolveTargetReturnValue = resolveTargetUrl(
          { specifier, contentType, isInline, isJsModule },
          target,
        )
        let isExternal = false
        let dependencyTargetUrl
        if (typeof resolveTargetReturnValue === "object") {
          if (resolveTargetReturnValue.external) {
            isExternal = true
          }
          dependencyTargetUrl = resolveTargetReturnValue.url
        } else {
          dependencyTargetUrl = resolveTargetReturnValue
        }

        if (dependencyTargetUrl.startsWith("data:")) {
          isExternal = false
          isInline = true
          const { mediaType, base64Flag, data } = parseDataUrl(dependencyTargetUrl)
          contentType = mediaType
          content = {
            type: mediaType,
            value: base64Flag ? new Buffer(data, "base64").toString() : decodeURI(data),
          }
        }

        // any hash in the url would mess up with filenames
        dependencyTargetUrl = removePotentialUrlHash(dependencyTargetUrl)

        if (contentType === undefined) {
          contentType = urlToContentType(dependencyTargetUrl)
        }

        if (!isEntry && isJsModule) {
          // for now we can only emit a chunk from an entry file as visible in
          // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
          // https://github.com/rollup/rollup/issues/2872
          logger.warn(
            `ignoring js reference found in an asset (it's only possible to reference js from entry asset)`,
          )
          return null
        }

        if (isInline && fileNamePattern === undefined) {
          // inherit parent directory location because it's an inline file
          fileNamePattern = () => {
            const importerBuildRelativeUrl = precomputeBuildRelativeUrlForTarget(target)
            const importerParentRelativeUrl = urlToRelativeUrl(
              urlToParentUrl(resolveUrl(importerBuildRelativeUrl, "file://")),
              "file://",
            )
            return `${importerParentRelativeUrl}[name]-[hash][extname]`
          }
        }

        const dependencyReference = createReference({
          referenceInfo: {
            url: target.url,
            line,
            column,
            contentType,
            previousJsDependency,
          },
          targetInfo: {
            url: dependencyTargetUrl,
            isExternal,
            isJsModule,
            isInline,
            disableHash,
            content,
            fileNamePattern,
          },
        })

        dependencies.push(dependencyReference)
        if (isJsModule) {
          previousJsDependency = dependencyReference
        }
        if (isExternal) {
          logger.debug(
            formatExternalReferenceLog(dependencyReference, {
              showReferenceSourceLocation,
              projectDirectoryUrl: urlToFileUrl(projectDirectoryUrl),
            }),
          )
        } else {
          logger.debug(
            formatReferenceFound(dependencyReference, {
              showReferenceSourceLocation,
            }),
          )
        }
        return dependencyReference
      }

      const parseReturnValue = await parse(target, {
        format,
        notifyReferenceFound: notifyDependencyFound,
      })
      parsingDone = true

      if (dependencies.length > 0 && typeof parseReturnValue !== "function") {
        throw new Error(
          `parse notified some dependencies, it must return a function but received ${parseReturnValue}`,
        )
      }
      if (typeof parseReturnValue === "function") {
        assetTransformMap[url] = parseReturnValue
      }
      if (dependencies.length > 0) {
        logger.debug(
          `${shortenUrl(url)} dependencies collected -> ${dependencies.map((dependencyReference) =>
            shortenUrl(dependencyReference.target.url),
          )}`,
        )
      }

      target.dependencies = dependencies
    })

    const getReadyPromise = memoize(async () => {
      if (target.isExternal) {
        // external urls are immediatly available and not modified
        return
      }

      // une fois que les dépendances sont transformées on peut transformer cet asset
      if (target.isJsModule) {
        // ici l'url n'est pas top parce que
        // l'url de l'asset est relative au fichier html source
        logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(url)}`)
        const rollupChunkReadyPromise = new Promise((resolve) => {
          registerCallbackOnceRollupChunkIsReady(target.url, resolve)
        })
        const {
          sourceAfterTransformation,
          buildRelativeUrl,
          fileName,
        } = await rollupChunkReadyPromise
        target.sourceAfterTransformation = sourceAfterTransformation
        target.buildRelativeUrl = buildRelativeUrl
        target.fileName = fileName
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      // mais si on a rien a transformer, on a pas vraiment besoin de tout ça
      await getDependenciesAvailablePromise()
      const dependencies = target.dependencies
      await Promise.all(
        dependencies.map((dependencyReference) => dependencyReference.target.getReadyPromise()),
      )

      const transform = assetTransformMap[url]
      if (typeof transform !== "function") {
        target.sourceAfterTransformation = target.content.value
        target.buildRelativeUrl = computeBuildRelativeUrlForTarget(target)
        return
      }

      // assetDependenciesMapping contains all dependencies for an asset
      // each key is the absolute url to the dependency file
      // each value is an url relative to the asset importing this dependency
      // it looks like this:
      // {
      //   "file:///project/coin.png": "./coin-45eiopri.png"
      // }
      // we don't yet know the exact importerBuildRelativeUrl but we can generate a fake one
      // to ensure we resolve dependency against where the importer file will be

      const importerBuildRelativeUrl = precomputeBuildRelativeUrlForTarget(target)
      const assetEmitters = []
      const transformReturnValue = await transform({
        precomputeBuildRelativeUrl: (sourceAfterTransformation) =>
          precomputeBuildRelativeUrlForTarget(target, sourceAfterTransformation),
        registerAssetEmitter: (callback) => {
          assetEmitters.push(callback)
        },
        getReferenceUrlRelativeToImporter: (reference) => {
          const referenceTarget = reference.target
          const referenceTargetBuildRelativeUrl =
            referenceTarget.fileName || referenceTarget.buildRelativeUrl
          const referenceTargetBuildUrl = resolveUrl(referenceTargetBuildRelativeUrl, "file:///")
          const importerBuildUrl = resolveUrl(importerBuildRelativeUrl, "file:///")
          return urlToRelativeUrl(referenceTargetBuildUrl, importerBuildUrl)
        },
      })
      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`)
      }

      let sourceAfterTransformation
      let buildRelativeUrl
      if (typeof transformReturnValue === "string") {
        sourceAfterTransformation = transformReturnValue
      } else {
        sourceAfterTransformation = transformReturnValue.sourceAfterTransformation
        if (transformReturnValue.buildRelativeUrl) {
          buildRelativeUrl = transformReturnValue.buildRelativeUrl
        }
      }

      target.sourceAfterTransformation = sourceAfterTransformation
      if (buildRelativeUrl === undefined) {
        buildRelativeUrl = computeBuildRelativeUrlForTarget(target)
      }
      target.buildRelativeUrl = buildRelativeUrl

      assetEmitters.forEach((callback) => {
        callback({
          emitAsset,
          buildDirectoryUrl,
        })
      })
    })

    const connect = memoize(async (connectFn) => {
      const { rollupReferenceId } = await connectFn()
      target.rollupReferenceId = rollupReferenceId
    })

    // the idea is to return the connect promise here
    // because connect is memoized and called immediatly after target is created
    const getRollupReferenceIdAvailablePromise = () => connect()

    // meant to be used only when asset is modified
    // after being emitted.
    // (sourcemap and importmap)
    const updateOnceReady = ({ sourceAfterTransformation, buildRelativeUrl }) => {
      // the source after transform has changed
      if (
        sourceAfterTransformation !== undefined &&
        sourceAfterTransformation !== target.sourceAfterTransformation
      ) {
        target.sourceAfterTransformation = sourceAfterTransformation
        if (buildRelativeUrl === undefined) {
          buildRelativeUrl = computeBuildRelativeUrlForTarget(target)
        }
      }

      // the build relative url has changed
      if (buildRelativeUrl !== undefined && buildRelativeUrl !== target.buildRelativeUrl) {
        buildRelativeUrlsToClean.push(target.buildRelativeUrl)
        target.buildRelativeUrl = buildRelativeUrl
        if (!target.isInline) {
          emitAsset({
            source: target.sourceAfterTransformation,
            fileName: buildRelativeUrl,
          })
        }
      }
    }

    Object.assign(target, {
      connect,

      getContentAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      getRollupReferenceIdAvailablePromise,

      updateOnceReady,
    })

    return target
  }

  const rollupChunkReadyCallbackMap = {}
  const registerCallbackOnceRollupChunkIsReady = (url, callback) => {
    rollupChunkReadyCallbackMap[url] = callback
  }
  const getRollupChunkReadyCallbackMap = () => rollupChunkReadyCallbackMap

  const findAssetUrlByBuildRelativeUrl = (buildRelativeUrl) => {
    const assetUrl = Object.keys(targetMap).find(
      (url) => targetMap[url].buildRelativeUrl === buildRelativeUrl,
    )
    return assetUrl
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const showReferenceSourceLocation = (reference) => {
    const referenceUrl = reference.url
    const referenceSource = String(
      referenceUrl in targetMap ? targetMap[referenceUrl].content.value : loadUrl(referenceUrl),
    )

    let message = `${urlToFileUrl(referenceUrl)}`
    if (typeof reference.line === "number") {
      message += `:${reference.line}`
      if (typeof reference.column === "number") {
        message += `:${reference.column}`
      }
    }

    if (referenceSource) {
      return `${message}

${showSourceLocation(referenceSource, {
  line: reference.line,
  column: reference.column,
})}
`
    }

    return `${message}`
  }

  return {
    createReferenceForAssetEntry,
    createReferenceForAsset,

    getRollupChunkReadyCallbackMap,
    getAllAssetEntryEmittedPromise,
    getBuildRelativeUrlsToClean,
    findAssetUrlByBuildRelativeUrl,

    inspect: () => {
      return {
        targetMap,
      }
    },
  }
}

export const assetReferenceToCodeForRollup = (reference) => {
  const target = reference.target
  if (target.isInline) {
    return getTargetAsBase64Url(target)
  }

  return `import.meta.ROLLUP_FILE_URL_${target.rollupReferenceId}`
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"
const assetFileNamePatternWithoutHash = "assets/[name][extname]"

const computeBuildRelativeUrlForTarget = (target) => {
  return computeBuildRelativeUrl(
    target.url,
    target.sourceAfterTransformation,
    targetToFileNamePattern(target),
  )
}

const targetToFileNamePattern = (target) => {
  if (target.fileNamePattern) {
    return target.fileNamePattern
  }

  if (target.disableHash) {
    if (target.isEntry) {
      return `[name][extname]`
    }
    return assetFileNamePatternWithoutHash
  }

  if (target.isEntry) {
    return `[name]-[hash][extname]`
  }
  return assetFileNamePattern
}

const precomputeBuildRelativeUrlForTarget = (target, sourceAfterTransformation = "") => {
  if (target.buildRelativeUrl) {
    return target.buildRelativeUrl
  }

  target.sourceAfterTransformation = sourceAfterTransformation
  const precomputedBuildRelativeUrl = computeBuildRelativeUrlForTarget(target)
  target.sourceAfterTransformation = undefined
  return precomputedBuildRelativeUrl
}

const memoize = (fn) => {
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

const getCallerLocation = () => {
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

const removePotentialUrlHash = (url) => {
  const urlObject = new URL(url)
  urlObject.hash = ""
  return String(urlObject)
}

const compareContentType = (leftContentType, rightContentType) => {
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

const formatContentTypeMismatchLog = (reference, { showReferenceSourceLocation }) => {
  return `A reference was expecting ${reference.contentType} but found ${
    reference.target.content.type
  } instead.
--- reference ---
${showReferenceSourceLocation(reference)}
--- target url ---
${reference.target.url}`
}

const formatExternalReferenceLog = (
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

const formatReferenceFound = (reference, { showReferenceSourceLocation }) => {
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
