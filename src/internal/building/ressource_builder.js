import {
  resolveUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  urlToParentUrl,
  urlToBasename,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { promiseTrackRace } from "../promise_track_race.js"
import { parseDataUrl } from "../dataUrl.utils.js"
import { showSourceLocation } from "./showSourceLocation.js"

import {
  getRessourceAsBase64Url,
  memoize,
  getCallerLocation,
  formatFoundReference,
  // formatDependenciesCollectedMessage,
  checkContentType,
} from "./ressource_builder_util.js"
import { computeBuildRelativeUrlForRessource } from "./asset_url_versioning.js"

export const createRessourceBuilder = (
  { fetch, parse },
  {
    logLevel,
    format,
    baseUrl,
    buildDirectoryRelativeUrl,

    urlToCompiledServerUrl,
    urlToHumanUrl,

    loadUrl = () => null,
    emitChunk,
    emitAsset,
    setAssetSource,
    onJsModuleReference = () => {},
    resolveRessourceUrl = ({ ressourceSpecifier, importerUrl }) =>
      resolveUrl(ressourceSpecifier, importerUrl),
    lineBreakNormalization,
  },
) => {
  const logger = createLogger({ logLevel })

  const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, baseUrl)

  const createReferenceForHTMLEntry = async ({
    entryContentType,
    entryUrl,
    entryBuffer,
    entryBuildRelativeUrl,
  }) => {
    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this ressource file
    const callerLocation = getCallerLocation()
    const entryReference = createReference({
      ressourceSpecifier: entryUrl,
      ressourceContentTypeExpected: entryContentType,
      referenceUrl: callerLocation.url,
      referenceLine: callerLocation.line,
      referenceColumn: callerLocation.column,

      contentType: entryContentType,
      bufferBeforeBuild: entryBuffer,

      isEntryPoint: true,

      // don't hash asset entry points
      urlVersioningDisabled: true,
      fileNamePattern: entryBuildRelativeUrl,
    })

    await entryReference.ressource.getDependenciesAvailablePromise()

    // on await que les assets, pour le js rollup s'en occupe
    await Promise.all(
      entryReference.ressource.dependencies.map(async (dependency) => {
        if (
          dependency.ressourceContentTypeExpected ===
          "application/importmap+json"
        ) {
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
        await readyPromise
      }),
    )
  }

  const createReferenceFoundInJs = async ({
    jsUrl,
    jsLine,
    jsColumn,

    ressourceSpecifier,
    contentType,
    bufferBeforeBuild,
  }) => {
    const reference = createReference({
      ressourceSpecifier,
      ressourceContentTypeExpected: contentType,
      referenceUrl: jsUrl,
      referenceColumn: jsLine,
      referenceLine: jsColumn,

      contentType,
      bufferBeforeBuild,
    })
    await reference.ressource.getReadyPromise()
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
  // ok il faudrait faire un truc dans ce genre:
  // lorsqu'on a un preload, on fait une promesse
  // pour le moment ou la ressource est référencé par un autre truc
  // ensuite dans le callback lorsque le build rollup est fini
  // la on considere que ça n'a jamais été référencé, on resoud la promesse
  // malgré tout
  const createReference = ({
    referenceShouldNotEmitChunk,
    isRessourceHint,
    ressourceContentTypeExpected,
    ressourceSpecifier,
    referenceUrl,
    referenceColumn,
    referenceLine,

    contentType,
    bufferBeforeBuild,
    isEntryPoint,
    isJsModule,
    isInline,
    fileNamePattern,
    urlVersioningDisabled,
  }) => {
    const importerUrl = referenceUrl
    const ressourceImporter = ressourceFromUrl(importerUrl) || {
      url: importerUrl,
      isEntryPoint: false, // maybe
      isJsModule: true,
      bufferAfterBuild: "",
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
      importerUrl: referenceUrl,
      importerIsEntryPoint: ressourceImporter.isEntryPoint,
      importerIsJsModule: ressourceImporter.isJsModule,
    })

    let ressourceUrl
    let isExternal = false
    if (typeof ressourceUrlResolution === "object") {
      if (ressourceUrlResolution.external) {
        isExternal = true
      }
      ressourceUrl = ressourceUrlResolution.url
    } else {
      ressourceUrl = ressourceUrlResolution
    }

    if (ressourceUrl.startsWith("data:")) {
      isExternal = false
      isInline = true
      const { mediaType, base64Flag, data } = parseDataUrl(ressourceUrl)
      ressourceContentTypeExpected = mediaType
      contentType = mediaType
      bufferBeforeBuild = base64Flag
        ? Buffer.from(data, "base64")
        : decodeURI(data)
    }

    // any hash in the url would mess up with filenames
    ressourceUrl = removePotentialUrlHash(ressourceUrl)

    if (isInline && fileNamePattern === undefined) {
      // inherit parent directory location because it's an inline file
      fileNamePattern = () => {
        const importerBuildRelativeUrl = precomputeBuildRelativeUrlForRessource(
          ressourceImporter,
          {
            lineBreakNormalization,
          },
        )
        const importerParentRelativeUrl = urlToRelativeUrl(
          urlToParentUrl(resolveUrl(importerBuildRelativeUrl, "file://")),
          "file://",
        )
        return `${importerParentRelativeUrl}[name]-[hash][extname]`
      }
    }

    const reference = {
      referenceShouldNotEmitChunk,
      isRessourceHint,
      ressourceContentTypeExpected,
      referenceUrl,
      referenceColumn,
      referenceLine,
    }

    const existingRessource = ressourceFromUrl(ressourceUrl)
    let ressource
    if (existingRessource) {
      ressource = existingRessource
      // allow to update the bufferBeforeBuild on existingRessource
      // this happens when rollup loads a js file and communicates to this code
      // what was loaded
      if (typeof bufferBeforeBuild !== "undefined") {
        ressource.bufferBeforeBuild = bufferBeforeBuild
        ressource.contentType = contentType
      }
    } else {
      ressource = createRessource({
        contentType,
        url: ressourceUrl,
        bufferBeforeBuild,

        isEntryPoint,
        isJsModule,
        isExternal,
        isInline,
        fileNamePattern,
        urlVersioningDisabled,
      })
      ressourceMap[ressourceUrl] = ressource
    }
    reference.ressource = ressource
    ressource.addReference(reference, { isJsModule })

    return reference
  }

  const ressourceTransformMap = {}

  const createRessource = ({
    contentType,
    ressourceUrl,
    bufferBeforeBuild,

    isEntryPoint = false,
    isJsModule = false,
    isExternal = false,
    isInline = false,

    fileNamePattern,
    urlVersioningDisabled = false,
  }) => {
    const ressource = {
      contentType,
      ressourceUrl,
      bufferBeforeBuild,
      firstStrongReference: null,
      references: [],

      isEntryPoint,
      isJsModule,
      isInline,
      isExternal,

      urlVersioningDisabled,
      fileNamePattern,

      ressourceRelativeUrl: urlToRelativeUrl(ressourceUrl, baseUrl),
      bufferAfterBuild: undefined,
    }

    ressource.usedPromise = new Promise((resolve) => {
      ressource.usedCallback = resolve
    })
    ressource.buildDonePromise = new Promise((resolve, reject) => {
      ressource.buildDoneCallback = ({ buildFileInfo, buildManifest }) => {
        if (!ressource.isJsModule) {
          // nothing special to do for asset targets
          resolve()
          return
        }

        // If the module is not in the rollup build, that's an error except when
        // rollup chunk was not emitted, which happens when:
        // - js was only preloaded/prefetched and never referenced afterwards
        // - js was only referenced by other js
        if (!buildFileInfo) {
          const referencedOnlyByRessourceHint = !ressource.firstStrongReference
          if (referencedOnlyByRessourceHint) {
            resolve()
            return
          }

          const referencedOnlyByOtherJs = ressource.references.every(
            (ref) => ref.referenceShouldNotEmitChunk,
          )
          if (referencedOnlyByOtherJs) {
            resolve()
            return
          }

          reject(
            new Error(
              `${shortenUrl(ressourceUrl)} cannot be found in the build info`,
            ),
          )
          return
        }

        const bufferAfterBuild = Buffer.from(buildFileInfo.code)
        const fileName = buildFileInfo.fileName
        const buildRelativeUrl = buildManifest[fileName] || fileName
        // const fileName = targetFileNameFromBuildManifest(buildManifest, buildRelativeUrl) || buildRelativeUrl
        ressource.bufferAfterBuild = bufferAfterBuild
        ressource.buildRelativeUrl = buildRelativeUrl
        ressource.fileName = fileName
        if (buildFileInfo.type === "chunk") {
          ressource.contentType = "application/javascript"
        }
        // logger.debug(`resolve rollup chunk ${shortenUrl(ressourceUrl)}`)
        resolve()
      }
    })

    const getBufferAvailablePromise = memoize(async () => {
      if (ressource.isJsModule) {
        await ressource.buildDonePromise
        return
      }

      if (!ressource.firstStrongReference) {
        // for preload/prefetch links, we don't want to start the prefetching right away.
        // Instead we wait for something else to reference the same ressource
        // This is by choice so that:
        // 1. The warning about "preload but never used" is prio fetch errors like "preload not found"
        // 2. We don't start fetching a ressource froun in HTML while rollup
        //    could do the same later. It means we should synchronize rollup
        //    and this asset builder fetching to avoid fetching twice.
        //    This scenario would be reproduced for every js module preloaded
        const { usedPromise, buildDonePromise } = ressource
        const { winner } = await promiseTrackRace([
          usedPromise,
          buildDonePromise,
        ])
        if (winner === buildDonePromise) {
          return
        }
      }

      const response = await fetch(
        ressourceUrl,
        showReferenceSourceLocation(ressource.firstStrongReference),
      )
      if (response.url !== ressourceUrl) {
        ressourceRedirectionMap[ressourceUrl] = response.url
        ressource.url = response.url
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
        ressourceContentTypeExpected,
        ressourceSpecifier,
        referenceLine,
        referenceColumn,

        contentType,
        bufferBeforeBuild,
        isJsModule = false,
        isInline = false,
        urlVersioningDisabled,
        fileNamePattern,
      }) => {
        if (parsingDone) {
          throw new Error(
            `notifyReferenceFound cannot be called once ${ressourceUrl} parsing is done.`,
          )
        }

        const dependencyReference = createReference({
          ressourceSpecifier,
          referenceUrl: ressourceUrl,
          referenceLine,
          referenceColumn,
          isRessourceHint,
          ressourceContentTypeExpected,

          contentType,
          bufferBeforeBuild,
          isJsModule,
          isInline,

          urlVersioningDisabled,
          fileNamePattern,
        })

        if (dependencyReference) {
          dependencies.push(dependencyReference)
        }
        return dependencyReference
      }

      if (!ressource.isEntryPoint) {
        logger.debug(`parse ${urlToHumanUrl(ressource.url)}`)
      }

      const parseReturnValue = await parse(ressource, {
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
        ressourceTransformMap[ressourceUrl] = parseReturnValue
      }
      ressource.dependencies = dependencies
      // if (dependencies.length > 0) {
      //   logger.debug(formatDependenciesCollectedMessage({ ressource, shortenUrl }))
      // }
    })

    const getReadyPromise = memoize(async () => {
      if (isExternal) {
        // external urls are immediatly available and not modified
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getDependenciesAvailablePromise()
      const dependencies = ressource.dependencies
      await Promise.all(
        dependencies.map(async (dependencyReference) => {
          await dependencyReference.ressource.getReadyPromise()
        }),
      )

      const transform = ressourceTransformMap[ressourceUrl]
      if (typeof transform !== "function") {
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

      const importerBuildRelativeUrl = precomputeBuildRelativeUrlForRessource(
        ressource,
        {
          lineBreakNormalization,
        },
      )
      const assetEmitters = []
      const transformReturnValue = await transform({
        precomputeBuildRelativeUrl: (bufferAfterBuild) =>
          precomputeBuildRelativeUrlForRessource(ressource, {
            bufferAfterBuild,
            lineBreakNormalization,
          }),
        registerAssetEmitter: (callback) => {
          assetEmitters.push(callback)
        },
        getReferenceUrlRelativeToImporter: (reference) => {
          const ressourceImporter = ressource
          const referenceRessource = reference.ressource

          let referenceBuildRelativeUrl

          if (ressourceImporter.isJsModule) {
            // js can reference an url without versionning
            // and actually fetch the versioned url thanks to importmap
            referenceBuildRelativeUrl =
              referenceRessource.fileName || referenceRessource.buildRelativeUrl
          } else {
            // other ressource must use the exact url
            referenceBuildRelativeUrl = referenceRessource.buildRelativeUrl
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
      })
      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`)
      }

      let bufferAfterBuild
      let buildRelativeUrl
      if (typeof transformReturnValue === "string") {
        bufferAfterBuild = transformReturnValue
      } else {
        bufferAfterBuild = transformReturnValue.bufferAfterBuild
        if (transformReturnValue.buildRelativeUrl) {
          buildRelativeUrl = transformReturnValue.buildRelativeUrl
        }
      }

      ressource.buildEnd(bufferAfterBuild, buildRelativeUrl)
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
      ressource.shouldBeIgnored = true
    }

    const buildEnd = (bufferAfterBuild, buildRelativeUrl) => {
      if (bufferAfterBuild !== undefined) {
        ressource.bufferAfterBuild = bufferAfterBuild
        if (buildRelativeUrl === undefined) {
          ressource.buildRelativeUrl = computeBuildRelativeUrlForRessource(
            ressource,
            {
              lineBreakNormalization,
            },
          )
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
        setAssetSource(ressource.rollupReferenceId, ressource.bufferAfterBuild)
      }
    }

    const onReference = (reference, infoFromReference) => {
      const effects = []
      if (ressource.isEntryPoint) {
        if (ressource.contentType === "text/html") {
          effects.push(`parse html to find references`)
        }
      } else {
        effects.push(
          `mark ${urlToHumanUrl(ressourceUrl)} as referenced by ${urlToHumanUrl(
            reference.referenceUrl,
          )}`,
        )
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
        effects.push(`mark ${urlToHumanUrl(ressourceUrl)} as js module`)
        ressource.isJsModule = infoFromReference.isJsModule
      }

      ressource.usedCallback()

      if (isExternal) {
        // nothing to do
        return effects
      }

      if (ressource.isJsModule) {
        if (!isEmitChunkNeeded({ ressource, reference })) {
          return effects
        }

        const jsModuleUrl = ressourceUrl

        onJsModuleReference({
          jsModuleUrl,
          jsModuleIsInline: isInline,
          jsModuleSource: String(bufferBeforeBuild),
        })

        const basenameUrl = resolveUrl(urlToBasename(jsModuleUrl), jsModuleUrl)
        const importerUrl = urlToCompiledServerUrl(reference.referenceUrl)
        const name = urlToRelativeUrl(basenameUrl, importerUrl).replace(
          new RegExp("../", "g"),
          "",
        )
        const rollupReferenceId = emitChunk({
          id: jsModuleUrl,
          name,
        })
        ressource.rollupReferenceId = rollupReferenceId
        effects.push(`emit rollup chunk "${name}" (${rollupReferenceId})`)
        return effects
      }

      if (isInline) {
        // nothing to do
        return effects
      }

      const rollupReferenceId = emitAsset({
        fileName: ressource.ressourceRelativeUrl,
      })
      ressource.rollupReferenceId = rollupReferenceId
      effects.push(
        `emit rollup asset "${ressource.ressourceRelativeUrl}" (${rollupReferenceId})`,
      )

      return effects
    }

    const addReference = (reference, infoFromReference) => {
      ressource.references.push(reference)

      const referenceEffects = onReference(reference, infoFromReference)

      logger.debug(
        formatFoundReference({
          reference,
          referenceEffects,
          showReferenceSourceLocation,
        }),
      )
    }

    Object.assign(ressource, {
      addReference,
      getBufferAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      remove,
      buildEnd,
    })

    return ressource
  }

  const buildEnd = ({ jsModuleBuild, buildManifest }) => {
    Object.keys(ressourceMap).forEach((ressourceUrl) => {
      const ressource = ressourceMap[ressourceUrl]
      const { buildDoneCallback } = ressource

      const buildRelativeUrl = Object.keys(jsModuleBuild).find(
        (buildRelativeUrlCandidate) => {
          const file = jsModuleBuild[buildRelativeUrlCandidate]
          return file.url === ressourceUrl
        },
      )
      const buildFileInfo = jsModuleBuild[buildRelativeUrl]

      buildDoneCallback({
        buildFileInfo,
        buildManifest,
      })
    })
  }

  const ressourceFromUrl = (url) => {
    if (url in ressourceMap) {
      return ressourceMap[url]
    }
    if (url in ressourceRedirectionMap) {
      return ressourceFromUrl(ressourceRedirectionMap[url])
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
    return urlIsInsideOf(url, baseUrl) ? urlToRelativeUrl(url, baseUrl) : url
  }

  const showReferenceSourceLocation = (reference) => {
    const referenceUrl = reference.referenceUrl
    const referenceRessource = ressourceFromUrl(referenceUrl)
    const referenceSource = referenceRessource
      ? referenceRessource.bufferBeforeBuild
      : loadUrl(referenceUrl)
    const referenceSourceAsString = referenceSource
      ? String(referenceSource)
      : ""

    let message = `${urlToHumanUrl(referenceUrl)}`
    if (typeof reference.referenceLine === "number") {
      message += `:${reference.referenceLine}`
      if (typeof reference.referenceColumn === "number") {
        message += `:${reference.referenceColumn}`
      }
    }

    if (
      referenceSourceAsString &&
      typeof reference.referenceLine === "number"
    ) {
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

const precomputeBuildRelativeUrlForRessource = (
  ressource,
  { bufferAfterBuild = "", lineBreakNormalization } = {},
) => {
  if (ressource.buildRelativeUrl) {
    return ressource.buildRelativeUrl
  }

  ressource.bufferAfterBuild = bufferAfterBuild
  const precomputedBuildRelativeUrl = computeBuildRelativeUrlForRessource(
    ressource,
    {
      lineBreakNormalization,
      contentType: ressource.contentType,
    },
  )
  ressource.bufferAfterBuild = undefined
  return precomputedBuildRelativeUrl
}

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
 * -https://github.com/rollup/rollup/issues/2872
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

  // html can reference js
  if (ressourceImporter.isEntryPoint) {
    return false
  }

  return `
WARNING: Ignoring reference to ${urlToHumanUrl(
    ressourceSpecifier,
  )} found inside ${urlToHumanUrl(referenceUrl)}.
`
}
