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

import {
  resolveUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  urlToParentUrl,
  urlToBasename,
} from "@jsenv/util"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
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
    urlToCompiledUrl,
    loadUrl = () => null,
    emitChunk,
    emitAsset,
    setAssetSource,
    onJsModuleReferencedInHtml = () => {},
    resolveTargetUrl = ({ targetSpecifier, importerUrl }) =>
      resolveUrl(targetSpecifier, importerUrl),
  },
) => {
  const logger = createLogger({
    logLevel,
  })

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

    // on await que les assets, pour le js rollup s'en occupe
    await Promise.all(
      entryReference.target.dependencies.map(async (dependency) => {
        if (dependency.target.targetIsJsModule) {
          // await internally for rollup to be done with these js files
          // but don't await explicitely or rollup build cannot end
          // because rollup would wait for this promise in "buildStart" hook
          // and never go to the "generateBundle' hook where
          // a js module ready promise gets resolved
          dependency.target.getReadyPromise()
          return
        }
        await dependency.target.getReadyPromise()
      }),
    )
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
    await reference.target.getReadyPromise()
    return reference
  }

  const getAllAssetEntryEmittedPromise = async () => {
    const urlToWait = Object.keys(targetMap).filter((url) => targetMap[url].targetIsEntry)
    return Promise.all(
      urlToWait.map(async (url) => {
        const target = targetMap[url]
        await target.getReadyPromise()
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
      targetBuildBuffer: "",
    }

    // for now we can only emit a chunk from an entry file as visible in
    // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
    // https://github.com/rollup/rollup/issues/2872
    if (targetIsJsModule && !importerTarget.targetIsEntry) {
      // it's not really possible
      logger.warn(
        `ignoring js reference found in an asset (js can be referenced only from an html entry point)`,
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
        importerReference: reference,

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

  const createTarget = ({
    importerReference,
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
      targetBuildBuffer: undefined,
    }

    const getBufferAvailablePromise = memoize(async () => {
      const response = await fetch(targetUrl, showReferenceSourceLocation(importerReference))
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

          targetContentType,
          targetBuffer,
          targetIsJsModule,
          targetIsInline,

          targetUrlVersioningDisabled,
          targetFileNamePattern,
        })

        if (dependencyReference) {
          dependencies.push(dependencyReference)
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
          createDetailedMessage(`${shortenUrl(targetUrl)} dependencies collected`, {
            dependencies: dependencies.map((dependencyReference) =>
              shortenUrl(dependencyReference.target.targetUrl),
            ),
          }),
        )
      }

      target.dependencies = dependencies
    })

    const getReadyPromise = memoize(async () => {
      if (targetIsExternal) {
        // external urls are immediatly available and not modified
        return
      }

      // once rollup is done with that module we know it's final url
      if (targetIsJsModule) {
        logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(targetUrl)}`)
        const rollupChunkReadyPromise = new Promise((resolve) => {
          registerCallbackOnceRollupChunkIsReady(target.targetUrl, resolve)
        })
        const {
          targetBuildBuffer,
          targetBuildRelativeUrl,
          targetFileName,
        } = await rollupChunkReadyPromise
        target.targetFileName = targetFileName
        target.targetBuildEnd(targetBuildBuffer, targetBuildRelativeUrl)
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getDependenciesAvailablePromise()
      const dependencies = target.dependencies
      await Promise.all(
        dependencies.map((dependencyReference) => dependencyReference.target.getReadyPromise()),
      )

      const transform = assetTransformMap[targetUrl]
      if (typeof transform !== "function") {
        target.targetBuildEnd(target.targetBuffer)
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
        precomputeBuildRelativeUrl: (targetBuildBuffer) =>
          precomputeBuildRelativeUrlForTarget(target, targetBuildBuffer),
        registerAssetEmitter: (callback) => {
          assetEmitters.push(callback)
        },
        getReferenceUrlRelativeToImporter: (reference) => {
          const importerTarget = target
          const referenceTarget = reference.target

          let referenceTargetBuildRelativeUrl
          // only js can reference an other file by url without versionning
          // and be able to actually fetch an other url with versioning using importmap
          // html needs the exact filename
          if (importerTarget.targetIsJsModule) {
            referenceTargetBuildRelativeUrl =
              referenceTarget.targetFileName || referenceTarget.targetBuildRelativeUrl
          } else {
            referenceTargetBuildRelativeUrl = referenceTarget.targetBuildRelativeUrl
          }

          const referenceTargetBuildUrl = resolveUrl(referenceTargetBuildRelativeUrl, "file:///")
          const importerBuildUrl = resolveUrl(importerBuildRelativeUrl, "file:///")
          return urlToRelativeUrl(referenceTargetBuildUrl, importerBuildUrl)
        },
      })
      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`)
      }

      let targetBuildBuffer
      let targetBuildRelativeUrl
      if (typeof transformReturnValue === "string") {
        targetBuildBuffer = transformReturnValue
      } else {
        targetBuildBuffer = transformReturnValue.targetBuildBuffer
        if (transformReturnValue.targetBuildRelativeUrl) {
          targetBuildRelativeUrl = transformReturnValue.targetBuildRelativeUrl
        }
      }

      target.targetBuildEnd(targetBuildBuffer, targetBuildRelativeUrl)
      assetEmitters.forEach((callback) => {
        callback({
          emitAsset,
          buildDirectoryUrl,
        })
      })
    })

    // used to remove sourcemap files that are renamed after they are emitted
    const remove = () => {
      target.shouldBeIgnored = true
    }

    const targetBuildEnd = (targetBuildBuffer, targetBuildRelativeUrl) => {
      if (targetBuildBuffer !== undefined) {
        target.targetBuildBuffer = targetBuildBuffer
        if (targetBuildRelativeUrl === undefined) {
          target.targetBuildRelativeUrl = computeBuildRelativeUrlForTarget(target)
        }
      }

      if (targetBuildRelativeUrl !== undefined) {
        target.targetBuildRelativeUrl = targetBuildRelativeUrl
      }

      if (!target.targetIsInline && !target.targetIsJsModule) {
        setAssetSource(target.rollupReferenceId, target.targetBuildBuffer)
      }
    }

    if (targetIsJsModule) {
      const jsModuleUrl = targetUrl

      onJsModuleReferencedInHtml({
        jsModuleUrl,
        jsModuleIsInline: targetIsInline,
        jsModuleSource: String(targetBuffer),
      })

      const name = urlToRelativeUrl(
        // get basename url
        resolveUrl(urlToBasename(jsModuleUrl), jsModuleUrl),
        // get importer url
        urlToCompiledUrl(importerReference.referenceUrl),
      )
      logger.debug(`emit chunk for ${shortenUrl(jsModuleUrl)}`)
      const rollupReferenceId = emitChunk({
        id: jsModuleUrl,
        name,
      })
      target.rollupReferenceId = rollupReferenceId
    } else if (targetIsInline) {
      // nothing to do
    } else {
      logger.debug(`emit asset for ${shortenUrl(targetUrl)}`)
      const rollupReferenceId = emitAsset({
        fileName: targetUrl,
      })
      target.rollupReferenceId = rollupReferenceId
    }

    Object.assign(target, {
      getBufferAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      remove,
      targetBuildEnd,
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

  const getAssetByUrl = (assetUrl) => {
    return targetMap[assetUrl] || null
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const showReferenceSourceLocation = (reference) => {
    const referenceUrl = reference.referenceUrl
    const referenceTarget = getTargetFromUrl(referenceUrl)
    const referenceSource = referenceTarget ? referenceTarget.targetBuffer : loadUrl(referenceUrl)
    const referenceSourceAsString = referenceSource ? String(referenceSource) : ""

    let message = `${urlToFileUrl(referenceUrl)}`
    if (typeof reference.referenceLine === "number") {
      message += `:${reference.referenceLine}`
      if (typeof reference.referenceColumn === "number") {
        message += `:${reference.referenceColumn}`
      }
    }

    if (referenceSourceAsString && typeof reference.referenceLine === "number") {
      return `${message}

${showSourceLocation(referenceSourceAsString, {
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
    getAssetByUrl,

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
