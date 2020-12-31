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
    resolveTargetUrl = ({ targetSpecifier, importerUrl }) =>
      resolveUrl(targetSpecifier, importerUrl),
  },
) => {
  const logger = createLogger({ logLevel })

  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)

  const createReferenceForHTMLEntry = async ({
    entryContentType,
    entryUrl,
    entryBuffer,
    entryBuildRelativeUrl,
  }) => {
    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation()
    const entryReference = createReference({
      referenceTargetSpecifier: entryUrl,
      referenceExpectedContentType: entryContentType,
      referenceUrl: callerLocation.url,
      referenceLine: callerLocation.line,
      referenceColumn: callerLocation.column,

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
    const htmlReadyPromise = entryReference.target.getReadyPromise()
    return { htmlReadyPromise }
  }

  const createReferenceForJs = async ({
    jsUrl,
    jsLine,
    jsColumn,

    targetSpecifier,
    targetContentType,
    targetBuffer,
  }) => {
    const reference = createReference({
      referenceTargetSpecifier: targetSpecifier,
      referenceExpectedContentType: targetContentType,
      referenceUrl: jsUrl,
      referenceColumn: jsLine,
      referenceLine: jsColumn,

      targetContentType,
      targetBuffer,
    })
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
  const targetRedirectionMap = {}
  const createReference = ({
    referenceTargetSpecifier,
    referenceExpectedContentType,
    referenceUrl,
    referenceColumn,
    referenceLine,

    targetContentType,
    targetBuffer,
    targetIsEntry,
    targetIsJsModule,
    targetIsInline,
    targetFileNamePattern,
    targetUrlVersioningDisabled,
  }) => {
    const importerUrl = referenceUrl
    const importerTarget = getTargetFromUrl(importerUrl) || {
      targetUrl: importerUrl,
      targetIsEntry: false, // maybe
      targetIsJsModule: true,
      targetBufferAfterTransformation: "",
    }

    // for now we can only emit a chunk from an entry file as visible in
    // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
    // https://github.com/rollup/rollup/issues/2872
    if (targetIsJsModule && !importerTarget.targetIsEntry) {
      // it's not really possible
      logger.warn(
        `ignoring js reference found in an asset (it's only possible to reference js from entry asset)`,
      )
      return null
    }

    const resolveTargetReturnValue = resolveTargetUrl({
      targetSpecifier: referenceTargetSpecifier,
      targetIsJsModule,
      targetIsInline,
      importerUrl: referenceUrl,
      importerIsEntry: importerTarget.targetIsEntry,
      importerIsJsModule: importerTarget.targetIsJsModule,
    })

    let targetUrl
    let targetIsExternal = false
    if (typeof resolveTargetReturnValue === "object") {
      if (resolveTargetReturnValue.external) {
        targetIsExternal = true
      }
      targetUrl = resolveTargetReturnValue.url
    } else {
      targetUrl = resolveTargetReturnValue
    }

    if (targetUrl.startsWith("data:")) {
      targetIsExternal = false
      targetIsInline = true
      const { mediaType, base64Flag, data } = parseDataUrl(targetUrl)
      referenceExpectedContentType = mediaType
      targetContentType = mediaType
      targetBuffer = base64Flag ? Buffer.from(data, "base64") : decodeURI(data)
    }

    // any hash in the url would mess up with filenames
    targetUrl = removePotentialUrlHash(targetUrl)

    if (targetIsInline && targetFileNamePattern === undefined) {
      // inherit parent directory location because it's an inline file
      targetFileNamePattern = () => {
        const importerBuildRelativeUrl = precomputeBuildRelativeUrlForTarget(importerTarget)
        const importerParentRelativeUrl = urlToRelativeUrl(
          urlToParentUrl(resolveUrl(importerBuildRelativeUrl, "file://")),
          "file://",
        )
        return `${importerParentRelativeUrl}[name]-[hash][extname]`
      }
    }

    const reference = {
      referenceExpectedContentType,
      referenceUrl,
      referenceColumn,
      referenceLine,
    }

    const existingTarget = getTargetFromUrl(targetUrl)

    if (existingTarget) {
      connectReferenceAndTarget(reference, existingTarget)
    } else {
      const target = createTarget({
        targetContentType,
        targetUrl,
        targetBuffer,

        targetIsEntry,
        targetIsJsModule,
        targetIsExternal,
        targetIsInline,
        targetFileNamePattern,
        targetUrlVersioningDisabled,
      })
      targetMap[targetUrl] = target
      connectReferenceAndTarget(reference, target)
      connectTarget(target)
    }

    if (targetIsExternal) {
      logger.debug(
        formatExternalReferenceLog(reference, {
          showReferenceSourceLocation,
          projectDirectoryUrl: urlToFileUrl(projectDirectoryUrl),
        }),
      )
    } else {
      logger.debug(formatReferenceFound(reference, showReferenceSourceLocation(reference)))
    }

    return reference
  }

  const connectReferenceAndTarget = (reference, target) => {
    reference.target = target
    target.targetReferences.push(reference)
    target.getBufferAvailablePromise().then(
      () => {
        checkContentType(reference, { logger, showReferenceSourceLocation })
      },
      () => {},
    )
  }

  const assetTransformMap = {}
  // used to remove sourcemap files that are renamed after they are emitted
  const buildRelativeUrlsToClean = []
  const getBuildRelativeUrlsToClean = () => buildRelativeUrlsToClean

  const createTarget = ({
    targetContentType,
    targetUrl,
    targetBuffer,

    targetIsEntry = false,
    targetIsJsModule = false,
    targetIsExternal = false,
    targetIsInline = false,

    targetFileNamePattern,
    targetUrlVersioningDisabled = false,
  }) => {
    const target = {
      targetContentType,
      targetUrl,
      targetBuffer,
      targetReferences: [],

      targetIsEntry,
      targetIsJsModule,
      targetIsInline,

      targetUrlVersioningDisabled,
      targetFileNamePattern,

      targetRelativeUrl: urlToRelativeUrl(targetUrl, projectDirectoryUrl),
      targetBufferAfterTransformation: undefined,
    }

    const getBufferAvailablePromise = memoize(async () => {
      const response = await fetch(
        targetUrl,
        showReferenceSourceLocation(target.targetReferences[0]),
      )
      if (response.url !== targetUrl) {
        targetRedirectionMap[targetUrl] = response.url
        target.targetUrl = response.url
      }

      const responseContentTypeHeader = response.headers["content-type"]
      target.targetContentType = responseContentTypeHeader

      const responseBodyAsArrayBuffer = await response.arrayBuffer()
      target.targetBuffer = Buffer.from(responseBodyAsArrayBuffer)
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
        referenceTargetSpecifier,
        referenceExpectedContentType,
        referenceLine,
        referenceColumn,

        targetContentType,
        targetBuffer,
        targetIsJsModule = false,
        targetIsInline = false,
        targetUrlVersioningDisabled,
        targetFileNamePattern,
      }) => {
        if (parsingDone) {
          throw new Error(
            `notifyReferenceFound cannot be called once ${targetUrl} parsing is done.`,
          )
        }

        const dependencyReference = createReference({
          referenceTargetSpecifier,
          referenceUrl: targetUrl,
          referenceLine,
          referenceColumn,
          referenceExpectedContentType,

          previousJsDependency,

          targetContentType,
          targetBuffer,
          targetIsJsModule,
          targetIsInline,

          targetUrlVersioningDisabled,
          targetFileNamePattern,
        })

        if (dependencyReference) {
          dependencies.push(dependencyReference)
          if (targetIsJsModule) {
            previousJsDependency = dependencyReference
          }
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
            shortenUrl(dependencyReference.target.targetUrl),
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
          registerCallbackOnceRollupChunkIsReady(target.targetUrl, resolve)
        })
        const {
          targetBufferAfterTransformation,
          targetBuildRelativeUrl,
          targetFileName,
        } = await rollupChunkReadyPromise
        target.targetBufferAfterTransformation = targetBufferAfterTransformation
        target.targetBuildRelativeUrl = targetBuildRelativeUrl
        target.targetFileName = targetFileName
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
        precomputeBuildRelativeUrl: (targetBufferAfterTransformation) =>
          precomputeBuildRelativeUrlForTarget(target, targetBufferAfterTransformation),
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

      let targetBufferAfterTransformation
      let targetBuildRelativeUrl
      if (typeof transformReturnValue === "string") {
        targetBufferAfterTransformation = transformReturnValue
      } else {
        targetBufferAfterTransformation = transformReturnValue.targetBufferAfterTransformation
        if (transformReturnValue.targetBuildRelativeUrl) {
          targetBuildRelativeUrl = transformReturnValue.targetBuildRelativeUrl
        }
      }

      target.targetBufferAfterTransformation = targetBufferAfterTransformation
      if (targetBuildRelativeUrl === undefined) {
        targetBuildRelativeUrl = computeBuildRelativeUrlForTarget(target)
      }
      target.targetBuildRelativeUrl = targetBuildRelativeUrl

      assetEmitters.forEach((callback) => {
        callback({
          emitAsset,
          buildDirectoryUrl,
        })
      })
    })

    let connectFn
    const connect = (value) => {
      connectFn = value
    }

    // the idea is to return the connect promise here
    // because connect is memoized and called immediatly after target is created
    const getRollupReferenceIdAvailablePromise = memoize(async () => {
      const { rollupReferenceId } = await connectFn()
      target.rollupReferenceId = rollupReferenceId
    })

    // meant to be used only when asset is modified
    // after being emitted.
    // (sourcemap and importmap)
    const updateOnceReady = ({ targetBufferAfterTransformation, buildRelativeUrl }) => {
      // the source after transform has changed
      if (
        targetBufferAfterTransformation !== undefined &&
        targetBufferAfterTransformation !== target.targetBufferAfterTransformation
      ) {
        target.targetBufferAfterTransformation = targetBufferAfterTransformation
        if (buildRelativeUrl === undefined) {
          buildRelativeUrl = computeBuildRelativeUrlForTarget(target)
        }
      }

      // the build relative url has changed
      if (buildRelativeUrl !== undefined && buildRelativeUrl !== target.targetBuildRelativeUrl) {
        buildRelativeUrlsToClean.push(target.targetBuildRelativeUrl)
        target.targetBuildRelativeUrl = buildRelativeUrl
        if (!target.targetIsInline) {
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

  const getTargetFromUrl = (url) => {
    if (url in targetMap) {
      return targetMap[url]
    }
    if (url in targetRedirectionMap) {
      return getTargetFromUrl(targetRedirectionMap[url])
    }
    return null
  }

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
    const referenceTarget = getTargetFromUrl(referenceUrl)
    const referenceSource = String(
      referenceTarget ? referenceTarget.targetBuffer : loadUrl(referenceUrl),
    )

    let message = `${urlToFileUrl(referenceUrl)}`
    if (typeof reference.referenceLine === "number") {
      message += `:${reference.referenceLine}`
      if (typeof reference.referenceColumn === "number") {
        message += `:${reference.referenceColumn}`
      }
    }

    if (referenceSource && typeof reference.referenceLine === "number") {
      return `${message}

${showSourceLocation(referenceSource, {
  line: reference.referenceLine,
  column: reference.referenceColumn,
})}
`
    }

    return `${message}`
  }

  return {
    createReferenceForHTMLEntry,
    createReferenceForJs,

    getRollupChunkReadyCallbackMap,
    getAllAssetEntryEmittedPromise,
    getBuildRelativeUrlsToClean,
    findAssetUrlByBuildRelativeUrl,

    inspect: () => {
      return {
        targetMap,
        targetRedirectionMap,
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
