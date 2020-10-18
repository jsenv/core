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
import { computeFileNameForRollup } from "./computeFileNameForRollup.js"
import { showSourceLocation } from "./showSourceLocation.js"

export const createCompositeAssetHandler = (
  { fetch, parse },
  {
    logLevel,
    projectDirectoryUrl = "file:///",
    bundleDirectoryUrl = "file:///",
    loadUrl = () => null,
    urlToOriginalProjectUrl = (url) => url,
    emitAsset,
    connectTarget = () => {},
    resolveTargetUrl = ({ specifier }, target) => resolveUrl(specifier, target.url),
  },
) => {
  const logger = createLogger({ logLevel })

  const prepareHtmlEntry = async (url, { fileNamePattern, source }) => {
    logger.debug(`prepare entry asset ${shortenUrl(url)}`)

    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation()
    const entryReference = createReference(
      {
        ...callerLocation,
        contentType: "text/html",
      },
      {
        isEntry: true,
        url,
        content: {
          type: "text/html",
          value: source,
        },
        fileNamePattern,
      },
    )

    await entryReference.target.getDependenciesAvailablePromise()
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    entryReference.target.getReadyPromise()
  }

  const targetMap = {}
  const createReference = (referenceData, targetData) => {
    const { url } = targetData
    const reference = { ...referenceData }

    if (url in targetMap) {
      const target = targetMap[url]
      connectReferenceAndTarget(reference, target)
      return reference
    }

    const target = createTarget(targetData)
    targetMap[url] = target
    connectReferenceAndTarget(reference, target)
    connectTarget(target)
    return reference
  }

  const connectReferenceAndTarget = (reference, target) => {
    reference.target = target
    target.importers.push(reference)
    target.getContentAvailablePromise().then(() => {
      if (!compareContentType(reference.contentType, target.content.type)) {
        logger.warn(formatContentTypeMismatchLog(reference, { showReferenceSourceLocation }))
      }
    })
  }

  const assetTransformMap = {}
  const fileNameToClean = []
  const createTarget = ({
    url,
    isEntry = false,
    isJsModule = false,
    isInline = false,
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
            const importerFileNameForRollup = precomputeTargetFileNameForRollup(target)
            const importerParentRelativeUrl = urlToRelativeUrl(
              urlToParentUrl(resolveUrl(importerFileNameForRollup, "file://")),
              "file://",
            )
            return `${importerParentRelativeUrl}[name]-[hash][extname]`
          }
        }

        const dependencyReference = createReference(
          {
            url: target.url,
            line,
            column,
            contentType,
            previousJsDependency,
          },
          {
            url: dependencyTargetUrl,
            isExternal,
            isJsModule,
            isInline,
            content,
            fileNamePattern,
          },
        )

        dependencies.push(dependencyReference)
        if (isJsModule) {
          previousJsDependency = dependencyReference
        }
        if (isExternal) {
          logger.debug(
            formatExternalReferenceLog(dependencyReference, {
              showReferenceSourceLocation,
              projectDirectoryUrl,
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
        const { sourceAfterTransformation, fileNameForRollup } = await rollupChunkReadyPromise
        target.sourceAfterTransformation = sourceAfterTransformation
        target.fileNameForRollup = fileNameForRollup
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
        target.fileNameForRollup = computeTargetFileNameForRollup(target)
        return
      }

      // assetDependenciesMapping contains all dependencies for an asset
      // each key is the absolute url to the dependency file
      // each value is an url relative to the asset importing this dependency
      // it looks like this:
      // {
      //   "file:///project/coin.png": "./coin-45eiopri.png"
      // }
      // we don't yet know the exact importerFileNameForRollup but we can generate a fake one
      // to ensure we resolve dependency against where the importer file will be

      const importerFileNameForRollup = precomputeTargetFileNameForRollup(target)
      const assetEmitters = []
      const transformReturnValue = await transform({
        precomputeFileNameForRollup: (sourceAfterTransformation) =>
          precomputeTargetFileNameForRollup(target, sourceAfterTransformation),
        registerAssetEmitter: (callback) => {
          assetEmitters.push(callback)
        },
        getReferenceUrlRelativeToImporter: (reference) => {
          const referenceTarget = reference.target
          const referenceFileNameForRollup = referenceTarget.fileNameForRollup
          const referenceUrlForRollup = resolveUrl(referenceFileNameForRollup, "file:///")
          const importerFileUrlForRollup = resolveUrl(importerFileNameForRollup, "file:///")
          return urlToRelativeUrl(referenceUrlForRollup, importerFileUrlForRollup)
        },
      })
      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`)
      }

      let sourceAfterTransformation
      let fileNameForRollup
      if (typeof transformReturnValue === "string") {
        sourceAfterTransformation = transformReturnValue
      } else {
        sourceAfterTransformation = transformReturnValue.sourceAfterTransformation
        if (transformReturnValue.fileNameForRollup) {
          fileNameForRollup = transformReturnValue.fileNameForRollup
        }
      }

      target.sourceAfterTransformation = sourceAfterTransformation
      if (fileNameForRollup === undefined) {
        fileNameForRollup = computeTargetFileNameForRollup(target)
      }
      target.fileNameForRollup = fileNameForRollup

      assetEmitters.forEach((callback) => {
        callback({
          emitAsset,
          bundleDirectoryUrl,
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

    const updateFileNameForRollup = (value) => {
      if (value !== target.fileNameForRollup) {
        fileNameToClean.push(target.fileNameForRollup)
        target.fileNameForRollup = value
      }
    }

    Object.assign(target, {
      connect,
      createReference,

      getContentAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      getRollupReferenceIdAvailablePromise,
      updateFileNameForRollup,
    })

    return target
  }

  const rollupChunkReadyCallbackMap = {}
  const registerCallbackOnceRollupChunkIsReady = (url, callback) => {
    rollupChunkReadyCallbackMap[url] = callback
  }

  const resolveJsReferencesUsingRollupBundle = async (rollupBundle) => {
    Object.keys(rollupChunkReadyCallbackMap).forEach((key) => {
      const chunkName = Object.keys(rollupBundle).find(
        (bundleKey) => rollupBundle[bundleKey].facadeModuleId === key,
      )
      const chunk = rollupBundle[chunkName]
      logger.debug(`resolve rollup chunk ${shortenUrl(key)}`)
      rollupChunkReadyCallbackMap[key]({
        sourceAfterTransformation: chunk.code,
        fileNameForRollup: chunk.fileName,
      })
    })

    // wait html files to be emitted
    const urlToWait = Object.keys(targetMap).filter((url) => targetMap[url].isEntry)
    await Promise.all(urlToWait.map((url) => targetMap[url].getRollupReferenceIdAvailablePromise()))
  }

  const cleanupRollupBundle = (rollupBundle) => {
    fileNameToClean.forEach((fileName) => {
      delete rollupBundle[fileName]
    })
  }

  const rollupBundleToAssetMappings = (rollupBundle) => {
    const assetMappings = {}
    Object.keys(rollupBundle).forEach((key) => {
      const file = rollupBundle[key]
      if (file.type === "asset") {
        const assetUrl = findAssetUrlByFileNameForRollup(file.fileName)
        if (assetUrl) {
          const originalProjectUrl = urlToOriginalProjectUrl(assetUrl)
          const projectRelativeUrl = urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl)
          assetMappings[projectRelativeUrl] = file.fileName
        } else {
          // the asset does not exists in the project it was generated during bundling
          // ici il est possible de trouver un asset ayant été redirigé ailleurs
        }
      }
    })
    return assetMappings
  }

  const findAssetUrlByFileNameForRollup = (fileNameForRollup) => {
    const assetUrl = Object.keys(targetMap).find(
      (url) => targetMap[url].fileNameForRollup === fileNameForRollup,
    )
    return assetUrl
  }

  const createJsModuleImportReference = async (response, { importerUrl } = {}) => {
    const contentType = response.headers["content-type"] || ""
    // const targetUrl = resolveTargetUrl({ specifier: response.url, contentType })
    const targetUrl = response.url
    const responseBodyAsBuffer = Buffer.from(await response.arrayBuffer())
    const reference = createReference(
      // the reference to this target comes from a static or dynamic import
      // parsed by rollup.
      // but we don't really know the line and column
      // because rollup does not share this information
      {
        url: importerUrl,
        column: undefined,
        line: undefined,
        contentType,
      },
      {
        url: targetUrl,
        content: {
          type: contentType,
          value: responseBodyAsBuffer,
        },
      },
    )

    logger.debug(formatReferenceFound(reference, { showReferenceSourceLocation }))
    await reference.target.getRollupReferenceIdAvailablePromise()
    return reference
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

    let message = `${urlToOriginalProjectUrl(referenceUrl)}`
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
    prepareHtmlEntry,
    resolveJsReferencesUsingRollupBundle,
    cleanupRollupBundle,
    rollupBundleToAssetMappings,
    createJsModuleImportReference,
    inspect: () => {
      return {
        targetMap,
      }
    },
  }
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"

const computeTargetFileNameForRollup = (target) => {
  return computeFileNameForRollup(
    target.url,
    target.sourceAfterTransformation,
    target.fileNamePattern || assetFileNamePattern,
  )
}

const precomputeTargetFileNameForRollup = (target, sourceAfterTransformation = "") => {
  if (target.fileNameForRollup) {
    return target.fileNameForRollup
  }

  target.sourceAfterTransformation = sourceAfterTransformation
  const precomputedFileNameForRollup = computeTargetFileNameForRollup(target)
  target.sourceAfterTransformation = undefined
  return precomputedFileNameForRollup
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
