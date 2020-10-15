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
import { parseDataUrl } from "../../parseDataUrl.js"
import { computeFileNameForRollup } from "./computeFileNameForRollup.js"
import { showSourceLocation } from "./showSourceLocation.js"

const logger = createLogger({ logLevel: "debug" })

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

export const createCompositeAssetHandler = (
  { fetch, parse },
  {
    projectDirectoryUrl = "file:///",
    bundleDirectoryUrl = "file:///",
    loadUrl = () => null,
    urlToOriginalProjectUrl = (url) => url,
    emitAsset,
    connectTarget = () => {},
    resolveTargetUrl = ({ specifier }, target) => resolveUrl(specifier, target.url),
  },
) => {
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
        isAsset: true,
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
      return [reference, target]
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
    target.getContentAvailablePromise.then(() => {
      if (reference.contentType !== target.content.type) {
        logger.warn(`A reference was expecting ${reference.contentType} but found ${
          target.content.type
        } instead.
--- reference ---
${showReferenceSourceLocation(reference)}
--- target url ---
${target.url}`)
      }
    })
  }

  const assetTransformMap = {}
  const createTarget = ({
    url,
    isEntry = false,
    isAsset = false,
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
      isAsset,
      isInline,
      content,
      sourceAfterTransformation,
      fileNamePattern,
      importers,
    }

    const getContentAvailablePromise = memoize(async () => {
      const response = await fetch(url, importers[0].url)
      const responseContentTypeHeader = response.headers["content-type"] || ""
      const responseBodyAsArrayBuffer = await response.arrayBuffer()
      target.content = {
        type: responseContentTypeHeader,
        value: Buffer.from(responseBodyAsArrayBuffer),
      }
    })
    if (content !== undefined) {
      getContentAvailablePromise.forceMemoization()
    }

    const getDependenciesAvailablePromise = memoize(async () => {
      await getContentAvailablePromise()
      const dependencies = []

      let previousJsDependency

      const notifyDependencyFound = ({
        isAsset,
        isInline,
        specifier,
        contentType,
        line,
        column,
        content,
        fileNamePattern,
      }) => {
        if (!isEntry && !isAsset) {
          // for now we can only emit a chunk from an entry file as visible in
          // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
          // https://github.com/rollup/rollup/issues/2872
          logger.warn(
            `ignoring js reference found in an asset (it's only possible to reference js from entry asset)`,
          )
          return null
        }

        const resolveTargetReturnValue = resolveTargetUrl({ specifier, isAsset, isInline }, target)
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
          content = {
            type: mediaType,
            value: base64Flag ? new Buffer(data, "base64").toString() : decodeURI(data),
          }
        }

        if (contentType === undefined) {
          contentType = urlToContentType(dependencyTargetUrl)
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
            isAsset,
            isInline,
            content,
            fileNamePattern,
          },
        )

        dependencies.push(dependencyReference)
        if (!isAsset) {
          previousJsDependency = dependencyReference
        }
        if (isExternal) {
          logger.debug(formatExternalReferenceLog(dependencyReference))
        } else {
          logger.debug(formatReferenceFound(dependencyReference))
        }
        return dependencyReference
      }

      const parseReturnValue = await parse(target, {
        notifyAssetFound: (data) =>
          notifyDependencyFound({
            isAsset: true,
            isInline: false,
            ...data,
          }),
        notifyInlineAssetFound: (data) =>
          notifyDependencyFound({
            isAsset: true,
            isInline: true,
            // inherit parent directory location because it's an inline asset
            fileNamePattern: () => {
              const importerFileNameForRollup = precomputeTargetFileNameForRollup(target)
              const importerParentRelativeUrl = urlToRelativeUrl(
                urlToParentUrl(resolveUrl(importerFileNameForRollup, "file://")),
                "file://",
              )
              return `${importerParentRelativeUrl}[name]-[hash][extname]`
            },
            ...data,
          }),
        notifyJsFound: (data) =>
          notifyDependencyFound({
            isAsset: false,
            isInline: false,
            ...data,
          }),
        notifyInlineJsFound: (data) =>
          notifyDependencyFound({
            isAsset: false,
            isInline: true,
            ...data,
          }),
      })

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
      if (!target.isAsset) {
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
      if (dependencies.length === 0) {
        target.sourceAfterTransformation = target.content.value
        target.fileNameForRollup = computeTargetFileNameForRollup(target)
        return
      }

      await Promise.all(
        dependencies.map((dependencyReference) => dependencyReference.target.getReadyPromise()),
      )
      const transform = assetTransformMap[url]
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
        const importerProjectUrl = target.url
        const importerBundleUrl = resolveUrl(fileNameForRollup, bundleDirectoryUrl)
        const { assetSource, assetUrl } = callback({
          importerProjectUrl,
          importerBundleUrl,
        })

        emitAsset({
          source: assetSource,
          fileName: urlToRelativeUrl(assetUrl, bundleDirectoryUrl),
        })
        logger.debug(`emit ${fileNameForRollup} asset emitted by ${fileNameForRollup}`)
      })
    })

    const connect = memoize(async (connectFn) => {
      const { rollupReferenceId } = await connectFn()
      target.rollupReferenceId = rollupReferenceId
    })

    // the idea is to return the connect promise here
    // because connect is memoized and called immediatly after target is created
    const getRollupReferenceIdAvailablePromise = () => connect()

    Object.assign(target, {
      connect,
      createReference,

      getContentAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      getRollupReferenceIdAvailablePromise,
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

  const getTargetFromResponse = async (response, { importerUrl } = {}) => {
    const targetUrl = response.responseUrl
    const contentType = response.headers["content-type"] || ""
    const assetReference = createReference(
      // the reference to this target comes from importerUrl
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
        isAsset: true,
        content: {
          type: contentType,
          value: Buffer.from(await response.arrayBuffer()),
        },
      },
    )

    logger.debug(formatReferenceFound(assetReference))
    await assetReference.target.getRollupReferenceIdAvailablePromise()
    return assetReference
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

    const message = `${urlToOriginalProjectUrl(referenceUrl)}:${reference.line}:${reference.column}`

    if (referenceSource) {
      return `${message}

${showSourceLocation(referenceSource, {
  line: reference.line,
  column: reference.column,
})}`
    }

    return `${message}`
  }

  const formatExternalReferenceLog = (reference) => {
    return `Found reference to an url outside project directory.
${showReferenceSourceLocation(reference)}
--- target url ---
${reference.target.url}
--- project directory url ---
${projectDirectoryUrl}`
  }

  const formatReferenceFound = (reference) => {
    const { target } = reference
    const targetUrl = shortenUrl(target.url)

    let message
    if (target.isInline && target.isAsset) {
      message = `found inline asset.`
    } else if (target.isInline) {
      message = `found inline js.`
    } else if (target.isAsset) {
      message = `found asset reference to ${targetUrl}.`
    } else {
      message = `found js reference to ${targetUrl}.`
    }

    message += `
${showReferenceSourceLocation(reference)}
`

    return message
  }

  return {
    prepareHtmlEntry,
    resolveJsReferencesUsingRollupBundle,
    getTargetFromResponse,

    showReferenceSourceLocation,
    inspect: () => {
      return {
        targetMap,
      }
    },
  }
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
