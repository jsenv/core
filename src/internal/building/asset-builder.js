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
import { createLogger } from "@jsenv/logger"

import { promiseTrackRace } from "../promise_track_race.js"
import { parseDataUrl } from "../dataUrl.utils.js"
import { showSourceLocation } from "./showSourceLocation.js"

import {
  getTargetAsBase64Url,
  memoize,
  getCallerLocation,
  formatFoundReference,
  // formatDependenciesCollectedMessage,
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
    urlToCompiledServerUrl,
    urlToHumanUrl,
    loadUrl = () => null,
    emitChunk,
    emitAsset,
    setAssetSource,
    onJsModuleReferencedInHtml = () => {},
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

    // on await que les assets, pour le js rollup s'en occupe
    await Promise.all(
      entryReference.target.dependencies.map(async (dependency) => {
        if (dependency.referenceExpectedContentType === "application/importmap+json") {
          // don't await for importmap right away, it must be handled as the very last asset
          // to be aware of build mappings.
          // getReadyPromise() for that importmap will be called during getAllAssetEntryEmittedPromise
          // (a simpler approach could keep importmap untouched and override it late
          // (but that means updating html hash and importmap hash)
          return
        }

        const { target } = dependency
        const readyPromise = target.getReadyPromise()
        if (target.targetIsJsModule) {
          // await internally for rollup to be done with this target js module
          // but don't await explicitely or rollup wait for asset builder
          // which is waiting for rollup
          return
        }
        if (!target.firstStrongReference) {
          // await internally for rollup to be done to see if this target gets referenced
          // but don't await explicitly or rollup would wait
          // for asset builder which is waiting for rollup
          return
        }
        await readyPromise
      }),
    )
  }

  const createReferenceFoundInJs = async ({
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
  // ok il faudrait faire un truc dans ce genre:
  // lorsqu'on a un preload, on fait une promesse
  // pour le moment ou la target est référencé par un autre truc
  // ensuite dans le callback lorsque le build rollup est fini
  // la on considere que ça n'a jamais été référencé, on resoud la promesse
  // malgré tout
  const createReference = ({
    referenceIsPreloadOrPrefetch,
    referenceExpectedContentType,
    referenceTargetSpecifier,
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

    const shouldBeIgnoredWarning = referenceShouldBeIgnoredWarning({
      targetIsJsModule,
      importerTarget,
      referenceTargetSpecifier,
      referenceUrl,
      urlToHumanUrl,
    })
    if (shouldBeIgnoredWarning) {
      logger.warn(shouldBeIgnoredWarning)
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
      referenceIsPreloadOrPrefetch,
      referenceExpectedContentType,
      referenceUrl,
      referenceColumn,
      referenceLine,
    }

    const existingTarget = getTargetFromUrl(targetUrl)
    let target
    if (existingTarget) {
      target = existingTarget
    } else {
      target = createTarget({
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
    }
    reference.target = target
    target.addReference(reference, { targetIsJsModule })

    return reference
  }

  const assetTransformMap = {}

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
      firstStrongReference: null,
      targetReferences: [],

      targetIsEntry,
      targetIsJsModule,
      targetIsInline,
      targetIsExternal,

      targetUrlVersioningDisabled,
      targetFileNamePattern,

      targetRelativeUrl: urlToRelativeUrl(targetUrl, projectDirectoryUrl),
      targetBuildBuffer: undefined,
    }

    target.usedPromise = new Promise((resolve) => {
      target.usedCallback = resolve
    })
    target.buildDonePromise = new Promise((resolve, reject) => {
      target.buildDoneCallback = ({ buildFileInfo, buildManifest }) => {
        if (!target.targetIsJsModule) {
          // nothing special to do for asset targets
          resolve()
          return
        }

        // If the module is not in the rollup build, that's an error
        // except if it was only preloaded/prefetched
        if (!buildFileInfo) {
          if (target.firstStrongReference) {
            reject(new Error(`${shortenUrl(targetUrl)} cannot be found in the build info`))
          } else {
            // target.targetBuildBuffer = "" // we don't know the file was never used
            // target.targetBuildRelativeUrl = "" // would depend from the file content
            // target.targetFileName = "" // would be the name given to that file for rollup
            resolve()
          }
          return
        }

        const targetBuildBuffer = buildFileInfo.code
        const targetFileName = buildFileInfo.fileName
        const targetBuildRelativeUrl = buildManifest[targetFileName] || targetFileName
        // const targetFileName = targetFileNameFromBuildManifest(buildManifest, targetBuildRelativeUrl) || targetBuildRelativeUrl
        target.targetBuildBuffer = targetBuildBuffer
        target.targetBuildRelativeUrl = targetBuildRelativeUrl
        target.targetFileName = targetFileName
        if (buildFileInfo.type === "chunk") {
          target.targetContentType = "application/javascript"
        }
        // logger.debug(`resolve rollup chunk ${shortenUrl(targetUrl)}`)
        resolve()
      }
    })

    const getBufferAvailablePromise = memoize(async () => {
      if (target.targetIsJsModule) {
        await target.buildDonePromise
        return
      }

      if (!target.firstStrongReference) {
        // for preload/prefetch links, we don't want to start the prefetching right away.
        // Instead we wait for something else to reference the same target
        // This is by choice so that:
        // 1. The warning about "preload but never used" is prio fetch errors like "preload not found"
        // 2. We don't start fetching a ressource froun in HTML while rollup
        //    could do the same later. It means we should synchronize rollup
        //    and this asset builder fetching to avoid fetching twice.
        //    This scenario would be reproduced for every js module preloaded
        const { usedPromise, buildDonePromise } = target
        const { winner } = await promiseTrackRace([usedPromise, buildDonePromise])
        if (winner === buildDonePromise) {
          return
        }
      }

      const response = await fetch(
        targetUrl,
        showReferenceSourceLocation(target.firstStrongReference),
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
      if (target.targetIsJsModule) {
        await target.buildDonePromise
        target.dependencies = []
        return
      }

      await getBufferAvailablePromise()
      const dependencies = []

      let parsingDone = false
      const notifyReferenceFound = ({
        referenceIsPreloadOrPrefetch,
        referenceExpectedContentType,
        referenceTargetSpecifier,
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
          referenceIsPreloadOrPrefetch,
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
      target.dependencies = dependencies
      // if (dependencies.length > 0) {
      //   logger.debug(formatDependenciesCollectedMessage({ target, shortenUrl }))
      // }
    })

    const getReadyPromise = memoize(async () => {
      if (targetIsExternal) {
        // external urls are immediatly available and not modified
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getDependenciesAvailablePromise()
      const dependencies = target.dependencies
      await Promise.all(
        dependencies.map(async (dependencyReference) => {
          await dependencyReference.target.getReadyPromise()
        }),
      )

      const transform = assetTransformMap[targetUrl]
      if (typeof transform !== "function") {
        target.targetBuildEnd(target.targetBuffer, target.targetBuildRelativeUrl)
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

          if (importerTarget.targetIsJsModule) {
            // js can reference an url without versionning
            // and actually fetch the versioned url thanks to importmap
            referenceTargetBuildRelativeUrl =
              referenceTarget.targetFileName || referenceTarget.targetBuildRelativeUrl
          } else {
            // other ressource must use the exact url
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

    // was used to remove sourcemap files that are renamed after they are emitted
    // could be useful one day in case an asset is finally discarded
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

      if (
        // target.targetBuildBuffer can be undefined when target is only preloaded
        // and never used
        target.targetBuildBuffer &&
        !target.targetIsInline &&
        !target.targetIsJsModule
      ) {
        setAssetSource(target.rollupReferenceId, target.targetBuildBuffer)
      }
    }

    const onReference = (reference, infoFromReference) => {
      const effects = []
      if (!target.targetIsEntry) {
        effects.push(
          `mark ${urlToHumanUrl(targetUrl)} as referenced by ${urlToHumanUrl(
            reference.referenceUrl,
          )}`,
        )
      }

      target.getBufferAvailablePromise().then(
        () => {
          if (target.firstStrongReference) {
            checkContentType(reference, { logger, showReferenceSourceLocation })
          }
        },
        () => {},
      )

      if (reference.referenceIsPreloadOrPrefetch) {
        // do not try to load or fetch this file
        // we'll wait for something to reference it
        // if nothing references it a warning will be logged
        return effects
      }

      if (target.firstStrongReference) {
        // this target was already strongly referenced by something
        // don't try to load it twice
        return effects
      }

      target.firstStrongReference = reference
      // the first strong reference is allowed to transform a reference where we did not know if it was
      // a js module to a js module
      // This happen for preload link following by a script type module
      // <link rel="preload" href="file.js" />
      // <script type="module" src="file.js"></script>
      if (!target.targetIsJsModule && infoFromReference.targetIsJsModule) {
        effects.push(`mark ${urlToHumanUrl(targetUrl)} as js module`)
        target.targetIsJsModule = infoFromReference.targetIsJsModule
      }

      target.usedCallback()

      if (targetIsExternal) {
        // nothing to do
        return effects
      }

      if (target.targetIsJsModule) {
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
          urlToCompiledServerUrl(reference.referenceUrl),
        )
        const rollupReferenceId = emitChunk({
          id: jsModuleUrl,
          name,
        })
        target.rollupReferenceId = rollupReferenceId
        effects.push(`emit rollup chunk "${name}" (${rollupReferenceId})`)
        return effects
      }

      if (targetIsInline) {
        // nothing to do
        return effects
      }

      const rollupReferenceId = emitAsset({
        fileName: target.targetRelativeUrl,
      })
      target.rollupReferenceId = rollupReferenceId
      effects.push(`emit rollup asset "${target.targetRelativeUrl}" (${rollupReferenceId})`)

      return effects
    }

    const addReference = (reference, infoFromReference) => {
      target.targetReferences.push(reference)

      const referenceEffects = onReference(reference, infoFromReference)

      logger.debug(
        formatFoundReference({
          reference,
          referenceEffects,
          showReferenceSourceLocation,
        }),
      )
    }

    Object.assign(target, {
      addReference,
      getBufferAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      remove,
      targetBuildEnd,
    })

    return target
  }

  const buildEnd = ({ jsBuild, buildManifest }) => {
    Object.keys(targetMap).forEach((targetUrl) => {
      const target = targetMap[targetUrl]
      const { buildDoneCallback } = target

      const targetBuildRelativeUrl = Object.keys(jsBuild).find((buildRelativeUrlCandidate) => {
        const file = jsBuild[buildRelativeUrlCandidate]
        const { facadeModuleId } = file
        return facadeModuleId && facadeModuleId === targetUrl
      })
      const buildFileInfo = jsBuild[targetBuildRelativeUrl]

      buildDoneCallback({
        buildFileInfo,
        buildManifest,
      })
    })
  }

  const getTargetFromUrl = (url) => {
    if (url in targetMap) {
      return targetMap[url]
    }
    if (url in targetRedirectionMap) {
      return getTargetFromUrl(targetRedirectionMap[url])
    }
    return null
  }

  const findAsset = (predicate) => {
    let assetMatching = null
    Object.keys(targetMap).find((assetUrl) => {
      const assetCandidate = targetMap[assetUrl]
      if (predicate(assetCandidate)) {
        assetMatching = assetCandidate
        return true
      }
      return false
    })
    return assetMatching
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
})}`
    }

    return `${message}`
  }

  return {
    createReference,
    createReferenceForHTMLEntry,
    createReferenceFoundInJs,

    buildEnd,
    getAllAssetEntryEmittedPromise,
    findAsset,

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

// const targetFileNameFromBuildManifest = (buildManifest, targetBuildRelativeUrl) => {
//   const key = Object.keys(buildManifest).find((keyCandidate) => {
//     return buildManifest[keyCandidate] === targetBuildRelativeUrl
//   })
//   return buildManifest[key]
// }

const removePotentialUrlHash = (url) => {
  const urlObject = new URL(url)
  urlObject.hash = ""
  return String(urlObject)
}

/*
 * We cannot reference js from asset (svg for example)
 * that is because rollup awaits for html to be ready which waits
 * fetch and parse its dependencies (let's say an svg)
 * which waits for js to be fetched and parsed
 * but the fetching + parsing of js happens in rollup
 * so rollup would end up waiting forever
 *
 * see also:
 * - https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
 * -https://github.com/rollup/rollup/issues/2872
 */
const referenceShouldBeIgnoredWarning = ({
  targetIsJsModule,
  importerTarget,
  referenceTargetSpecifier,
  referenceUrl,
  urlToHumanUrl,
}) => {
  if (!targetIsJsModule) {
    return false
  }

  // js can reference js
  if (importerTarget.targetIsJsModule) {
    return false
  }

  // html can reference js
  if (importerTarget.targetIsEntry) {
    return false
  }

  return `
WARNING: Ignoring reference to ${urlToHumanUrl(
    referenceTargetSpecifier,
  )} found inside ${urlToHumanUrl(referenceUrl)}.
`
}
