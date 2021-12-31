import {
  resolveUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  urlToFilename,
} from "@jsenv/filesystem"
import { createLogger, loggerToLevels } from "@jsenv/logger"

import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { racePromises } from "../promise_race.js"
import { parseDataUrl } from "../dataUrl.utils.js"

import {
  getRessourceAsBase64Url,
  memoize,
  getCallerLocation,
  formatFoundReference,
  // formatDependenciesCollectedMessage,
  checkContentType,
} from "./ressource_builder_util.js"
import { stringifyUrlSite } from "./url_trace.js"

export const createRessourceBuilder = (
  { urlFetcher, urlLoader, parseRessource },
  {
    logLevel,
    format,
    compileServerOrigin,
    buildDirectoryUrl,

    asOriginalServerUrl,
    urlToHumanUrl,

    onAsset,
    onAssetSourceUpdated,
    onJsModule,
    resolveRessourceUrl,
    urlVersioner,
  },
) => {
  const logger = createLogger({ logLevel })

  const createReferenceForEntryPoint = async ({
    entryContentType,
    entryUrl,
    entryBuffer,
  }) => {
    // The entry point is conceptually referenced by code passing "entryPointMap"
    // to buildProject. So we analyse stack trace to put this function caller
    // as the reference to this ressource file
    // we store this info in reference.isProgrammatic
    const callerLocation = getCallerLocation()
    const entryReference = createReference({
      ressourceSpecifier: entryUrl,
      contentTypeExpected: entryContentType,
      referenceUrl: callerLocation.url,
      referenceLine: callerLocation.line,
      referenceColumn: callerLocation.column,

      contentType: entryContentType,
      bufferBeforeBuild: entryBuffer,

      isEntryPoint: true,
    })
    entryReference.isProgrammatic = true

    await entryReference.ressource.getDependenciesAvailablePromise()

    // on await que les assets, pour le js rollup s'en occupe
    await Promise.all(
      entryReference.ressource.dependencies.map(async (dependency) => {
        if (dependency.contentTypeExpected === "application/importmap+json") {
          // don't await for importmap right away, it must be handled as the very last asset
          // to be aware of build mappings.
          // getReadyPromise() for that importmap will be called during getAllAssetEntryEmittedPromise
          // (a simpler approach could keep importmap untouched and override it late
          // (but that means updating html hash and importmap hash)
          return
        }

        const { ressource } = dependency
        const readyPromise = ressource.getReadyPromise()
        if (ressource.isJsModule) {
          // await internally for rollup to be done with this ressource js module
          // but don't await explicitely or rollup wait for asset builder
          // which is waiting for rollup
          return
        }
        if (!ressource.firstStrongReference) {
          // await internally for rollup to be done to see if this ressource gets referenced
          // but don't await explicitly or rollup would wait
          // for asset builder which is waiting for rollup
          return
        }
        if (ressource.isPlaceholder) {
          return
        }
        await readyPromise
      }),
    )
  }

  const createReferenceFoundByRollup = async (params) => {
    return createReference({
      fromRollup: true,
      ...params,
    })
  }

  const createReferenceFoundInJsModule = ({
    referenceLabel,
    jsUrl,
    jsLine,
    jsColumn,
    isImportAssertion,

    contentTypeExpected,
    ressourceSpecifier,
    contentType,
    bufferBeforeBuild,
  }) => {
    const reference = createReference({
      isImportAssertion,
      ressourceSpecifier,
      contentTypeExpected,
      referenceLabel,
      referenceUrl: jsUrl,
      referenceLine: jsLine,
      referenceColumn: jsColumn,

      contentType,
      bufferBeforeBuild,
    })
    return reference
  }

  const getAllEntryPointsEmittedPromise = async () => {
    const urlToWait = Object.keys(ressourceMap).filter(
      (url) => ressourceMap[url].isEntryPoint,
    )
    return Promise.all(
      urlToWait.map(async (url) => {
        const ressource = ressourceMap[url]
        await ressource.getReadyPromise()
        return ressource
      }),
    )
  }

  const ressourceMap = {}
  const ressourceRedirectionMap = {}
  const createReference = ({
    referenceShouldNotEmitChunk,
    isRessourceHint,
    isImportAssertion,
    contentTypeExpected,
    ressourceSpecifier,
    referenceLabel,
    referenceUrl,
    referenceColumn,
    referenceLine,

    contentType,
    bufferBeforeBuild,
    isEntryPoint,
    isJsModule,
    isSourcemap,
    isInline,
    isPlaceholder,

    urlVersioningDisabled,

    fromRollup,
  }) => {
    const existingRessourceForReference = findRessourceByUrl(referenceUrl)
    let ressourceImporter
    if (existingRessourceForReference) {
      ressourceImporter = existingRessourceForReference
    } else {
      const referenceOriginalUrl = asOriginalServerUrl(referenceUrl)
      if (referenceOriginalUrl) {
        ressourceImporter = findRessourceByUrl(referenceOriginalUrl)
      }
      if (!ressourceImporter) {
        // happens only for entry points?
        // in that case the importer is theoric
        // see "getCallerLocation()" in createReferenceForEntryPoint
        ressourceImporter = {
          url: referenceUrl,
          isEntryPoint: false,
          isJsModule: true,
          bufferAfterBuild: "",
        }
      }
    }

    const shouldBeIgnoredWarning = referenceShouldBeIgnoredWarning({
      isJsModule,
      ressourceImporter,
      ressourceSpecifier,
      referenceUrl,
      urlToHumanUrl,
    })
    if (shouldBeIgnoredWarning) {
      logger.warn(shouldBeIgnoredWarning)
      return null
    }

    const ressourceUrlResolution = resolveRessourceUrl({
      ressourceSpecifier,
      isJsModule,
      isInline,
      isRessourceHint,
      ressourceImporter,
    })

    let ressourceUrl
    let isExternal = false
    let isWorker = false
    let isServiceWorker = false
    if (typeof ressourceUrlResolution === "object") {
      if (ressourceUrlResolution.isExternal) {
        isExternal = true
      }
      if (ressourceUrlResolution.isWorker) {
        isWorker = true
      }
      if (ressourceUrlResolution.isServiceWorker) {
        isServiceWorker = true
      }
      if (ressourceUrlResolution.isJsModule) {
        isJsModule = true
      }
      ressourceUrl = ressourceUrlResolution.url
    } else {
      ressourceUrl = ressourceUrlResolution
    }

    if (ressourceUrl.startsWith("data:")) {
      isExternal = false
      isInline = true
      const { mediaType, base64Flag, data } = parseDataUrl(ressourceUrl)
      contentTypeExpected = mediaType
      contentType = mediaType
      bufferBeforeBuild = base64Flag
        ? Buffer.from(data, "base64")
        : decodeURI(data)
    }

    // any hash in the url would mess up with filenames
    ressourceUrl = removePotentialUrlHash(ressourceUrl)

    const existingRessource = findRessourceByUrl(ressourceUrl)
    let ressource
    if (existingRessource) {
      ressource = existingRessource
      // allow to update the bufferBeforeBuild on existingRessource
      // this happens when rollup loads a js file and communicates to this code
      // what was loaded
      if (fromRollup) {
        ressource.bufferBeforeBuild = bufferBeforeBuild
        ressource.contentType = contentType
      }
    } else {
      ressource = createRessource({
        contentType,
        ressourceUrl,
        ressourceImporter,
        bufferBeforeBuild,

        isEntryPoint,
        isJsModule,
        isSourcemap,
        isExternal,
        isInline,
        isPlaceholder,
        isWorker,
        isServiceWorker,

        urlVersioningDisabled,
      })
      ressourceMap[ressourceUrl] = ressource
    }

    const reference = {
      referenceShouldNotEmitChunk,
      isRessourceHint,
      isImportAssertion,
      contentTypeExpected,
      referenceLabel,
      referenceUrl,
      referenceColumn,
      referenceLine,

      isInline,
      inlinedCallback: () => {
        reference.isInline = true
        const allStrongReferenceAreInline = ressource.references.every(
          (reference) => reference.isRessourceHint || reference.isInline,
        )
        if (allStrongReferenceAreInline) {
          ressource.isInline = true
          ressource.inlinedCallbacks.forEach((callback) => callback())
        }
      },
    }

    reference.ressource = ressource
    if (fromRollup && ressourceImporter.isEntryPoint) {
      // When HTML references JS, ressource builder has emitted the js chunk.
      // so it already knows it exists and is part of references
      // -> no need to push into reference (would incorrectly consider html references js twice)
      // -> no need to log the js ressource (already logged during the HTML parsing)
    } else {
      ressource.references.push(reference)
      const effects = ressource.applyReferenceEffects(reference, { isJsModule })
      if (loggerToLevels(logger).debug) {
        logger.debug(
          formatFoundReference({
            reference,
            referenceEffects: effects,
            showReferenceSourceLocation,
            shortenUrl,
          }),
        )
      }
    }

    return reference
  }

  const ressourceTransformMap = {}

  const createRessource = ({
    contentType,
    ressourceUrl,
    ressourceImporter,
    bufferBeforeBuild,

    isEntryPoint = false,
    isJsModule = false,
    isSourcemap = false,
    isExternal = false,
    isInline = false,
    isPlaceholder = false,
    isWorker = false,
    isServiceWorker = false,

    urlVersioningDisabled,
  }) => {
    const ressource = {
      contentType,
      url: ressourceUrl,
      importer: ressourceImporter,
      bufferBeforeBuild,
      firstStrongReference: null,
      references: [],

      isEntryPoint,
      isJsModule,
      isSourcemap,
      isInline,
      isExternal,
      isPlaceholder,
      isWorker,
      isServiceWorker,

      urlVersioningDisabled,

      relativeUrl: urlToRelativeUrl(ressourceUrl, compileServerOrigin),
      bufferAfterBuild: undefined,
    }

    ressource.usedPromise = new Promise((resolve) => {
      ressource.usedCallback = resolve
    })
    ressource.inlinedCallbacks = []
    ressource.buildEndCalledCallbacks = []
    ressource.buildEndCalledPromise = new Promise((resolve) => {
      ressource.buildEndCalledCallbacks.push(resolve)
    })
    ressource.rollupBuildDoneCallbacks = []
    ressource.rollupBuildDonePromise = new Promise((resolve) => {
      ressource.rollupBuildDoneCallbacks.push(resolve)
    })

    const getBufferAvailablePromise = memoize(async () => {
      if (ressource.isJsModule) {
        await ressource.rollupBuildDonePromise
        return
      }

      // sourcemap placeholder buffer is ready once buildEnd is called on it
      if (ressource.isPlaceholder) {
        await ressource.buildEndCalledPromise
        return
      }

      if (!ressource.firstStrongReference) {
        // for preload/prefetch links, we don't want to start the prefetching right away.
        // Instead we wait for something else to reference the same ressource
        // This is by choice so that:
        // 1. The warning about "preload but never used" is prio fetch errors like "preload not found"
        // 2. We don't start fetching a ressource found in HTML while rollup
        //    could do the same later. It means we should synchronize rollup
        //    and this asset builder fetching to avoid fetching twice.
        //    This scenario would be reproduced for every js module preloaded
        const { usedPromise, rollupBuildDonePromise } = ressource
        const winner = await racePromises([usedPromise, rollupBuildDonePromise])
        if (winner.promise === rollupBuildDonePromise) {
          return
        }
      }

      const response = await urlFetcher.fetchUrl(ressource.url, {
        contentTypeExpected: ressource.firstStrongReference.contentTypeExpected,
        urlTrace: () => {
          return createRessourceTrace({
            ressource,
            createUrlSiteFromReference,
            findRessourceByUrl,
          })
        },
      })
      if (response.url !== ressource.url) {
        const urlBeforeRedirection = ressource.url
        const urlAfterRedirection = response.url
        ressourceRedirectionMap[urlBeforeRedirection] = urlAfterRedirection
        ressource.url = urlAfterRedirection
      }

      const responseContentTypeHeader = response.headers["content-type"]
      ressource.contentType = responseContentTypeHeader

      const responseBodyAsArrayBuffer = await response.arrayBuffer()
      ressource.bufferBeforeBuild = Buffer.from(responseBodyAsArrayBuffer)
    })
    if (bufferBeforeBuild !== undefined) {
      getBufferAvailablePromise.forceMemoization(Promise.resolve())
    }

    const getDependenciesAvailablePromise = memoize(async () => {
      await getBufferAvailablePromise()

      if (ressource.isJsModule) {
        ressource.dependencies = []
        return
      }

      const dependencies = []

      let parsingDone = false
      const notifyReferenceFound = ({
        isRessourceHint,
        contentTypeExpected,
        ressourceSpecifier,
        referenceLabel,
        referenceLine,
        referenceColumn,

        contentType,
        bufferBeforeBuild,
        isJsModule = false,
        isInline = false,
        isSourcemap = false,
        isPlaceholder = false,
        urlVersioningDisabled,
      }) => {
        if (parsingDone) {
          throw new Error(
            `notifyReferenceFound cannot be called once ${ressource.url} parsing is done.`,
          )
        }

        const dependencyReference = createReference({
          ressourceSpecifier,
          referenceLabel,
          referenceUrl: ressource.url,
          referenceLine,
          referenceColumn,
          isRessourceHint,
          contentTypeExpected,

          contentType,
          bufferBeforeBuild,
          isJsModule,
          isInline,
          isSourcemap,
          isPlaceholder,

          urlVersioningDisabled,
        })

        if (dependencyReference) {
          dependencies.push(dependencyReference)
        }
        return dependencyReference
      }

      if (!ressource.isEntryPoint) {
        logger.debug(`parse ${urlToHumanUrl(ressource.url)}`)
      }

      const parseReturnValue = await parseRessource(ressource, {
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
        ressourceTransformMap[ressource.url] = parseReturnValue
      }
      ressource.dependencies = dependencies
      // if (dependencies.length > 0) {
      //   logger.debug(formatDependenciesCollectedMessage({ ressource, shortenUrl }))
      // }
    })

    const getReadyPromise = memoize(async () => {
      if (ressource.isExternal) {
        // external urls are immediatly available and not modified
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getDependenciesAvailablePromise()
      const dependencies = ressource.dependencies
      await Promise.all(
        dependencies.map(async (dependencyReference) => {
          const dependencyRessource = dependencyReference.ressource
          if (dependencyRessource.isPlaceholder) {
            return
          }
          await dependencyRessource.getReadyPromise()
        }),
      )

      const transform = ressourceTransformMap[ressource.url]
      if (typeof transform !== "function") {
        if (ressource.isPlaceholder) {
          return
        }
        // sourcemap content depends on their source file
        // sourcemap.buildEnd() will be called by the source file
        if (ressource.isSourcemap) {
          return
        }
        ressource.buildEnd(
          ressource.bufferAfterBuild || ressource.bufferBeforeBuild,
          ressource.buildRelativeUrl,
        )
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
      const importerBuildRelativeUrl =
        urlVersioner.precomputeBuildRelativeUrl(ressource)
      await transform({
        buildDirectoryUrl,
        precomputeBuildRelativeUrl: (ressource) =>
          urlVersioner.precomputeBuildRelativeUrl(ressource),
        getUrlRelativeToImporter: (referencedRessource) => {
          const ressourceImporter = ressource

          let referenceBuildRelativeUrl

          if (ressourceImporter.isJsModule) {
            // js can reference an url without versionning
            // and actually fetch the versioned url thanks to importmap
            referenceBuildRelativeUrl =
              referencedRessource.fileName ||
              referencedRessource.buildRelativeUrl
          } else {
            // other ressource must use the exact url
            referenceBuildRelativeUrl = referencedRessource.buildRelativeUrl
          }

          const referenceBuildUrl = resolveUrl(
            referenceBuildRelativeUrl,
            "file:///",
          )
          const importerBuildUrl = resolveUrl(
            importerBuildRelativeUrl,
            "file:///",
          )
          return urlToRelativeUrl(referenceBuildUrl, importerBuildUrl)
        },
        getOriginalRessource: (ressource) => {
          const originalServerUrl = asOriginalServerUrl(ressource.url)
          return ressourceMap[originalServerUrl]
        },
      })
      if (typeof ressource.bufferAfterBuild === "undefined") {
        throw new Error(
          `transform must call ressource.buildEnd() for ${ressource.url}`,
        )
      }
    })

    // was used to remove sourcemap files that are renamed after they are emitted
    // could be useful one day in case an asset is finally discarded
    const remove = () => {
      ressource.shouldBeIgnored = true
    }

    const buildEnd = (bufferAfterBuild, buildRelativeUrl) => {
      if (bufferAfterBuild !== undefined) {
        ressource.bufferAfterBuild = bufferAfterBuild
        if (buildRelativeUrl === undefined) {
          ressource.buildRelativeUrl =
            urlVersioner.computeBuildRelativeUrl(ressource)
        }
      }

      if (buildRelativeUrl !== undefined) {
        ressource.buildRelativeUrl = buildRelativeUrl
      }

      if (
        // ressource.bufferAfterBuild can be undefined when ressource is only preloaded
        // and never used
        ressource.bufferAfterBuild &&
        !ressource.isInline &&
        !ressource.isJsModule
      ) {
        onAssetSourceUpdated({ ressource })
      }
    }

    const applyReferenceEffects = (reference, infoFromReference) => {
      const effects = []
      if (ressource.isEntryPoint) {
        if (ressource.contentType === "text/html") {
          effects.push(`parse html to find references`)
        }
      }

      if (reference.isRessourceHint) {
        // do not try to load or fetch this file
        // we'll wait for something to reference it
        // if nothing references it a warning will be logged
        return effects
      }

      ressource.getBufferAvailablePromise().then(
        () => {
          if (ressource.firstStrongReference) {
            checkContentType(reference, { logger, showReferenceSourceLocation })
          }
        },
        () => {},
      )

      if (ressource.firstStrongReference) {
        // this ressource was already strongly referenced by something
        // don't try to load it twice
        return effects
      }

      ressource.firstStrongReference = reference
      // the first strong reference is allowed to transform a reference where we did not know if it was
      // a js module to a js module
      // This happen for preload link following by a script type module
      // <link rel="preload" href="file.js" />
      // <script type="module" src="file.js"></script>
      if (!ressource.isJsModule && infoFromReference.isJsModule) {
        effects.push(`mark ${urlToHumanUrl(ressource.url)} as js module`)
        ressource.isJsModule = infoFromReference.isJsModule
      }

      ressource.usedCallback()

      if (ressource.isExternal) {
        // nothing to do
        return effects
      }

      if (ressource.isJsModule) {
        if (!isEmitChunkNeeded({ ressource, reference })) {
          return effects
        }

        const jsModuleUrl = ressource.url
        const rollupChunk = onJsModule({
          ressource,
          jsModuleUrl,
          jsModuleIsInline: ressource.isInline,
          jsModuleSource: String(bufferBeforeBuild),
          line: reference.referenceLine,
          column: reference.referenceColumn,
        })
        ressource.rollupReferenceId = rollupChunk.rollupReferenceId
        effects.push(
          `emit rollup chunk "${rollupChunk.fileName}" (${rollupChunk.rollupReferenceId})`,
        )
        return effects
      }

      if (ressource.isInline) {
        // nothing to do
        return effects
      }

      const rollupAsset = onAsset({
        ressource,
      })
      ressource.rollupReferenceId = rollupAsset.rollupReferenceId
      effects.push(
        `emit rollup asset "${rollupAsset.fileName}" (${rollupAsset.rollupReferenceId})`,
      )
      return effects
    }

    Object.assign(ressource, {
      applyReferenceEffects,
      getBufferAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      remove,
      buildEnd,
    })

    return ressource
  }

  const rollupBuildEnd = ({ jsChunks }) => {
    Object.keys(ressourceMap).forEach((ressourceUrl) => {
      const ressource = ressourceMap[ressourceUrl]

      const key = Object.keys(jsChunks).find((key) => {
        const rollupFileInfo = jsChunks[key]
        return rollupFileInfo.url === ressourceUrl
      })
      const rollupFileInfo = jsChunks[key]
      applyBuildEndEffects(ressource, { rollupFileInfo })
      const { rollupBuildDoneCallbacks } = ressource
      rollupBuildDoneCallbacks.forEach((rollupBuildDoneCallback) => {
        rollupBuildDoneCallback()
      })
    })
  }

  const applyBuildEndEffects = (
    ressource,
    {
      rollupFileInfo,
      // buildManifest
    },
  ) => {
    if (!ressource.isJsModule) {
      // nothing special to do for non-js ressources
      return
    }

    // If the module is not in the rollup build, that's an error except when
    // rollup chunk was not emitted, which happens when:
    // - js was only preloaded/prefetched and never referenced afterwards
    // - js was only referenced by other js
    if (!rollupFileInfo) {
      const referencedOnlyByRessourceHint = !ressource.firstStrongReference
      if (referencedOnlyByRessourceHint) {
        return
      }

      const referencedOnlyByOtherJs = ressource.references.every(
        (ref) => ref.referenceShouldNotEmitChunk,
      )
      if (referencedOnlyByOtherJs) {
        return
      }

      throw new Error(
        `${shortenUrl(ressource.url)} cannot be found in the build info`,
      )
    }

    const fileName = rollupFileInfo.fileName
    // const buildRelativeUrl = buildManifest[fileName] || fileName
    let code = rollupFileInfo.code

    if (rollupFileInfo.type === "chunk") {
      ressource.contentType = "application/javascript"
    }
    ressource.fileName = fileName
    ressource.buildEnd(
      code,
      // buildRelativeUrl
    )

    const map = rollupFileInfo.map
    if (map) {
      const jsBuildUrl = resolveUrl(
        ressource.buildRelativeUrl,
        buildDirectoryUrl,
      )
      const sourcemapUrlForJs = `${urlToFilename(jsBuildUrl)}.map`
      code = setJavaScriptSourceMappingUrl(code, sourcemapUrlForJs)
      rollupFileInfo.code = code
      ressource.bufferAfterBuild = code
    }
  }

  const findRessourceByUrl = (url) => {
    if (url in ressourceMap) {
      return ressourceMap[url]
    }
    if (url in ressourceRedirectionMap) {
      return findRessourceByUrl(ressourceRedirectionMap[url])
    }
    return null
  }

  const findRessource = (predicate) => {
    let ressourceFound = null
    Object.keys(ressourceMap).find((url) => {
      const ressourceCandidate = ressourceMap[url]
      if (predicate(ressourceCandidate)) {
        ressourceFound = ressourceCandidate
        return true
      }
      return false
    })
    return ressourceFound
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, compileServerOrigin)
      ? urlToRelativeUrl(url, compileServerOrigin)
      : url
  }

  const createUrlSiteFromReference = (reference) => {
    const { referenceUrl, referenceLine, referenceColumn } = reference
    const referenceRessource = findRessourceByUrl(referenceUrl)
    const referenceSource = referenceRessource
      ? referenceRessource.bufferBeforeBuild
      : urlLoader.getUrlResponseTextFromMemory(referenceUrl)
    const referenceSourceAsString = referenceSource
      ? String(referenceSource)
      : ""

    const urlSite = {
      type:
        referenceRessource && referenceRessource.isJsModule
          ? "import"
          : "reference",
      url: urlToHumanUrl(referenceUrl),
      line: referenceLine,
      column: referenceColumn,
      source: referenceSourceAsString,
    }

    if (!referenceRessource.isInline) {
      return urlSite
    }
    const { firstStrongReference } = referenceRessource
    if (!firstStrongReference) {
      return urlSite
    }
    const htmlUrlSite = createUrlSiteFromReference(firstStrongReference)
    // when the html node is injected there is no line in the source file to target
    if (htmlUrlSite.line === undefined) {
      return urlSite
    }
    const importerRessource = findRessourceByUrl(
      firstStrongReference.referenceUrl,
    )
    if (!importerRessource || importerRessource.contentType !== "text/html") {
      return urlSite
    }
    return {
      ...htmlUrlSite,
      line: htmlUrlSite.line + urlSite.line,
      column: htmlUrlSite.column + urlSite.column,
    }
  }

  const showReferenceSourceLocation = (reference) => {
    return stringifyUrlSite(createUrlSiteFromReference(reference))
  }

  return {
    createReferenceForEntryPoint,
    createReferenceFoundByRollup,
    createReferenceFoundInJsModule,

    rollupBuildEnd,
    getAllEntryPointsEmittedPromise,
    findRessource,

    inspect: () => {
      return {
        ressourceMap,
        ressourceRedirectionMap,
      }
    },
  }
}

// const preredirectUrlFromRessource = (ressource, ressourceRedirectionMap) => {
//   const ressourceUrlPreRedirect = Object.keys(ressourceRedirectionMap).find(
//     (urlPreRedirect) =>
//       ressourceRedirectionMap[urlPreRedirect] === ressource.url,
//   )
//   return ressourceUrlPreRedirect
// }

export const referenceToCodeForRollup = (reference) => {
  const ressource = reference.ressource
  if (ressource.isInline) {
    return getRessourceAsBase64Url(ressource)
  }

  return `import.meta.ROLLUP_FILE_URL_${ressource.rollupReferenceId}`
}

// const targetFileNameFromBuildManifest = (buildManifest, buildRelativeUrl) => {
//   const key = Object.keys(buildManifest).find((keyCandidate) => {
//     return buildManifest[keyCandidate] === buildRelativeUrl
//   })
//   return buildManifest[key]
// }

const createRessourceTrace = ({
  ressource,
  createUrlSiteFromReference,
  findRessourceByUrl,
}) => {
  // we could pass a way to build the import trace
  // it can be deduced by starting with the firstStrongReference
  // and trying to get a ressource for that reference
  // to get an other firstStrongReference
  // everytime we could build the sourcelocation
  // but for importer after the first once just line and column are enough
  // the source code would be too much

  const { firstStrongReference } = ressource
  const trace = [createUrlSiteFromReference(firstStrongReference)]

  const next = (reference) => {
    const referenceRessource = findRessourceByUrl(reference.referenceUrl)
    if (!referenceRessource) {
      return
    }
    const { firstStrongReference } = referenceRessource
    if (!firstStrongReference) {
      return
    }
    // ignore the programmatic reference
    if (firstStrongReference.isProgrammatic) {
      return
    }
    trace.push(createUrlSiteFromReference(firstStrongReference))
    next(firstStrongReference)
  }
  next(firstStrongReference)

  return trace
}

const removePotentialUrlHash = (url) => {
  const urlObject = new URL(url)
  urlObject.hash = ""
  return String(urlObject)
}

const isEmitChunkNeeded = ({ ressource, reference }) => {
  if (reference.referenceShouldNotEmitChunk) {
    // si la ressource est preload ou prefetch
    const isReferencedByRessourceHint = ressource.references.some(
      (ref) => ref.isRessourceHint,
    )
    if (isReferencedByRessourceHint) {
      return true
    }
    return false
  }
  return true
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
 * - https://github.com/rollup/rollup/issues/2872
 */
const referenceShouldBeIgnoredWarning = ({
  isJsModule,
  ressourceImporter,
  ressourceSpecifier,
  referenceUrl,
  urlToHumanUrl,
}) => {
  if (!isJsModule) {
    return false
  }

  // js can reference js
  if (ressourceImporter.isJsModule) {
    return false
  }

  // entry point can reference js (html)
  if (ressourceImporter.isEntryPoint) {
    return false
  }

  return `
WARNING: Ignoring reference to ${urlToHumanUrl(
    ressourceSpecifier,
  )} found inside ${urlToHumanUrl(referenceUrl)}.
`
}
