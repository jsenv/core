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
import { resolveUrl, urlToRelativeUrl, urlIsInsideOf, urlToParentUrl } from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { parseDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"
import { showSourceLocation } from "./showSourceLocation.js"

import {
  getTargetAsBase64Url,
  memoize,
  getCallerLocation,
  formatReferenceFound,
  formatExternalReferenceLog,
  checkContentType,
} from "./asset-builder.util.js"
import {
  computeBuildRelativeUrlForTarget,
  precomputeBuildRelativeUrlForTarget,
} from "./asset-url-versioning.js"

export const createAssetBuilder = (
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
    resolveTargetUrl = ({ referenceSpecifier }, target) =>
      resolveUrl(referenceSpecifier, target.url),
  },
) => {
  const logger = createLogger({ logLevel })

  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)

  const createReferenceForAssetEntry = async ({
    entryUrl,
    entryContentType,
    entryBuffer,
    entryBuildRelativeUrl,
  }) => {
    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation()
    const entryReference = createReference({
      referenceUrl: callerLocation.url,
      referenceLine: callerLocation.line,
      referenceColumn: callerLocation.column,
      referenceExpectedContentType: entryContentType,

      targetUrl: entryUrl,
      targetContentType: entryContentType,
      targetBuffer: entryBuffer,
      targetIsEntry: true,
      // don't hash asset entry points
      targetUrlVersioningDisabled: true,
      targetFileNamePattern: entryBuildRelativeUrl,
    })

    await entryReference.target.getDependenciesAvailablePromise()
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    entryReference.target.getReadyPromise()
  }

  const createReferenceForAsset = async ({
    referenceUrl,
    referenceColumn,
    referenceLine,
    referenceExpectedContentType,

    targetUrl,
    targetContentType = referenceExpectedContentType,
    targetBuffer,
  }) => {
    const reference = createReference({
      referenceUrl,
      referenceColumn,
      referenceLine,
      referenceExpectedContentType,

      targetUrl,
      targetContentType,
      targetBuffer,
    })
    logger.debug(formatReferenceFound(reference, { showReferenceSourceLocation }))
    await reference.target.getRollupReferenceIdAvailablePromise()
    return reference
  }

  const getAllAssetEntryEmittedPromise = async () => {
    const urlToWait = Object.keys(targetMap).filter((url) => targetMap[url].targetIsEntry)
    return Promise.all(
      urlToWait.map(async (url) => {
        const target = targetMap[url]
        await target.getRollupReferenceIdAvailablePromise()
        return target
      }),
    )
  }

  const targetMap = {}
  const createReference = ({
    referenceUrl,
    referenceColumn,
    referenceLine,
    referenceExpectedContentType,

    targetUrl,
    targetContentType,
    targetBuffer,
    targetIsEntry,
    targetIsJsModule,
    targetIsInline,
    targetFileNamePattern,
    targetUrlVersioningDisabled,
  }) => {
    const reference = {
      referenceUrl,
      referenceColumn,
      referenceLine,
      referenceExpectedContentType,
    }

    if (targetUrl in targetMap) {
      const target = targetMap[targetUrl]
      connectReferenceAndTarget(reference, target)
      return reference
    }

    const target = createTarget({
      targetUrl,
      targetContentType,
      targetBuffer,

      targetIsEntry,
      targetIsJsModule,
      targetIsInline,
      targetFileNamePattern,
      targetUrlVersioningDisabled,
    })
    targetMap[targetUrl] = target
    connectReferenceAndTarget(reference, target)
    connectTarget(target)
    return reference
  }

  const connectReferenceAndTarget = (reference, target) => {
    reference.target = target
    target.targetReferences.push(reference)
    target.getContentAvailablePromise().then(() => {
      checkContentType(reference, { logger, showReferenceSourceLocation })
    })
  }

  const assetTransformMap = {}
  // used to remove sourcemap files that are renamed after they are emitted
  const buildRelativeUrlsToClean = []
  const getBuildRelativeUrlsToClean = () => buildRelativeUrlsToClean

  const createTarget = ({
    targetUrl,
    targetContentType,
    targetBuffer,

    targetIsEntry = false,
    targetIsJsModule = false,
    targetIsExternal = false,
    targetIsInline = false,
    targetFileNamePattern,
    targetUrlVersioningDisabled = false,
  }) => {
    const target = {
      targetUrl,
      targetContentType,
      targetBuffer,
      targetReferences: [],

      targetUrlVersioningDisabled,
      targetFileNamePattern,

      targetIsEntry,
      targetIsJsModule,
      targetIsInline,

      targetRelativeUrl: urlToRelativeUrl(targetUrl, projectDirectoryUrl),
      targetBufferAfterTransformation: undefined,
    }

    const getBufferAvailablePromise = memoize(async () => {
      const response = await fetch(
        targetUrl,
        showReferenceSourceLocation(target.targetReferences[0]),
      )

      const responseContentTypeHeader = response.headers["content-type"] || ""
      target.targetContentType = responseContentTypeHeader

      target.targetBuffer = Buffer.from(responseBodyAsArrayBuffer)
      const responseBodyAsArrayBuffer = await response.arrayBuffer()
    })
    if (targetBuffer !== undefined) {
      getBufferAvailablePromise.forceMemoization(Promise.resolve())
    }

    const getDependenciesAvailablePromise = memoize(async () => {
      await getBufferAvailablePromise()
      const dependencies = []

      let previousJsDependency
      let parsingDone = false
      const notifyReferenceFound = ({
        referenceSpecifier,
        referenceLine,
        referenceColumn,
        referenceExpectedContentType,
        targetBuffer,
        targetIsJsModule = false,
        targetUrlVersioningDisabled,
        targetFileNamePattern,
      }) => {
        if (parsingDone) {
          throw new Error(
            `notifyReferenceFound cannot be called once ${targetUrl} parsing is done.`,
          )
        }

        let targetIsInline = typeof targetBuffer !== "undefined"
        const resolveTargetReturnValue = resolveTargetUrl(
          {
            referenceSpecifier,
            referenceExpectedContentType,
            targetIsInline,
            targetIsJsModule,
          },
          target,
        )
        let targetIsExternal = false
        let dependencyTargetUrl
        if (typeof resolveTargetReturnValue === "object") {
          if (resolveTargetReturnValue.external) {
            targetIsExternal = true
          }
          dependencyTargetUrl = resolveTargetReturnValue.url
        } else {
          dependencyTargetUrl = resolveTargetReturnValue
        }

        if (dependencyTargetUrl.startsWith("data:")) {
          targetIsExternal = false
          targetIsInline = true
          const { mediaType, base64Flag, data } = parseDataUrl(dependencyTargetUrl)
          referenceExpectedContentType = mediaType
          targetContentType = mediaType
          targetBuffer = base64Flag ? Buffer.from(data, "base64") : decodeURI(data)
        }

        // any hash in the url would mess up with filenames
        dependencyTargetUrl = removePotentialUrlHash(dependencyTargetUrl)

        if (referenceExpectedContentType === undefined) {
          referenceExpectedContentType = urlToContentType(dependencyTargetUrl)
        }

        if (!targetIsEntry && targetIsJsModule) {
          // for now we can only emit a chunk from an entry file as visible in
          // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
          // https://github.com/rollup/rollup/issues/2872
          logger.warn(
            `ignoring js reference found in an asset (it's only possible to reference js from entry asset)`,
          )
          return null
        }

        if (targetIsInline && targetFileNamePattern === undefined) {
          // inherit parent directory location because it's an inline file
          targetFileNamePattern = () => {
            const importerBuildRelativeUrl = precomputeBuildRelativeUrlForTarget(target)
            const importerParentRelativeUrl = urlToRelativeUrl(
              urlToParentUrl(resolveUrl(importerBuildRelativeUrl, "file://")),
              "file://",
            )
            return `${importerParentRelativeUrl}[name]-[hash][extname]`
          }
        }

        const dependencyReference = createReference({
          referenceUrl: targetUrl,
          referenceLine,
          referenceColumn,
          referenceExpectedContentType,

          previousJsDependency,

          targetUrl: dependencyTargetUrl,
          targetBuffer,
          targetIsJsModule,
          targetIsExternal,
          targetIsInline,
          targetUrlVersioningDisabled,
          targetFileNamePattern,
        })

        dependencies.push(dependencyReference)
        if (targetIsJsModule) {
          previousJsDependency = dependencyReference
        }
        if (targetIsExternal) {
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
        notifyReferenceFound,
      })
      parsingDone = true

      if (dependencies.length > 0 && typeof parseReturnValue !== "function") {
        throw new Error(
          `parse notified some dependencies, it must return a function but received ${parseReturnValue}`,
        )
      }
      if (typeof parseReturnValue === "function") {
        assetTransformMap[targetUrl] = parseReturnValue
      }
      if (dependencies.length > 0) {
        logger.debug(
          `${shortenUrl(
            targetUrl,
          )} dependencies collected -> ${dependencies.map((dependencyReference) =>
            shortenUrl(dependencyReference.target.url),
          )}`,
        )
      }

      target.dependencies = dependencies
    })

    const getReadyPromise = memoize(async () => {
      if (targetIsExternal) {
        // external urls are immediatly available and not modified
        return
      }

      // une fois que les dépendances sont transformées on peut transformer cet asset
      if (targetIsJsModule) {
        // ici l'url n'est pas top parce que
        // l'url de l'asset est relative au fichier html source
        logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(targetUrl)}`)
        const rollupChunkReadyPromise = new Promise((resolve) => {
          registerCallbackOnceRollupChunkIsReady(target.url, resolve)
        })
        const {
          sourceAfterTransformation,
          buildRelativeUrl,
          fileName,
        } = await rollupChunkReadyPromise
        target.targetBufferAfterTransformation = sourceAfterTransformation
        target.targetBuildRelativeUrl = buildRelativeUrl
        target.targetFileName = fileName
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      // mais si on a rien a transformer, on a pas vraiment besoin de tout ça
      await getDependenciesAvailablePromise()
      const dependencies = target.dependencies
      await Promise.all(
        dependencies.map((dependencyReference) => dependencyReference.target.getReadyPromise()),
      )

      const transform = assetTransformMap[targetUrl]
      if (typeof transform !== "function") {
        target.targetBufferAfterTransformation = target.targetBuffer
        target.targetBuildRelativeUrl = computeBuildRelativeUrlForTarget(target)
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
            referenceTarget.targetFileName || referenceTarget.targetBuildRelativeUrl
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

      target.targetBufferAfterTransformation = sourceAfterTransformation
      if (buildRelativeUrl === undefined) {
        buildRelativeUrl = computeBuildRelativeUrlForTarget(target)
      }
      target.targetBuildRelativeUrl = buildRelativeUrl

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
        sourceAfterTransformation !== target.targetBufferAfterTransformation
      ) {
        target.targetBufferAfterTransformation = sourceAfterTransformation
        if (buildRelativeUrl === undefined) {
          buildRelativeUrl = computeBuildRelativeUrlForTarget(target)
        }
      }

      // the build relative url has changed
      if (buildRelativeUrl !== undefined && buildRelativeUrl !== target.targetBuildRelativeUrl) {
        buildRelativeUrlsToClean.push(target.buildRelativeUrl)
        target.targetBuildRelativeUrl = buildRelativeUrl
        if (!target.isInline) {
          emitAsset({
            source: target.targetBufferAfterTransformation,
            fileName: buildRelativeUrl,
          })
        }
      }
    }

    Object.assign(target, {
      connect,

      getBufferAvailablePromise,
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
      (url) => targetMap[url].targetBuildRelativeUrl === buildRelativeUrl,
    )
    return assetUrl
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const showReferenceSourceLocation = (reference) => {
    const referenceUrl = reference.referenceUrl
    const referenceSource = String(
      referenceUrl in targetMap ? targetMap[referenceUrl].targetBuffer : loadUrl(referenceUrl),
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
  line: reference.refrenceLine,
  column: reference.referenceColumn,
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

export const referenceToCodeForRollup = (reference) => {
  const target = reference.target
  if (target.targetIsInline) {
    return getTargetAsBase64Url(target)
  }

  return `import.meta.ROLLUP_FILE_URL_${target.rollupReferenceId}`
}

const removePotentialUrlHash = (url) => {
  const urlObject = new URL(url)
  urlObject.hash = ""
  return String(urlObject)
}
