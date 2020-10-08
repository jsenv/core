import { resolveUrl, urlToRelativeUrl, urlIsInsideOf } from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { computeFileRelativeUrlForBundle } from "./computeFileRelativeUrlForBundle.js"

const logger = createLogger({ logLevel: "debug" })

export const createCompositeAssetHandler = (
  { load, parse },
  { projectDirectoryUrl = "file:///", connectReference = () => {} },
) => {
  const entryReferences = {}

  const prepareAssetEntry = async (url) => {
    logger.debug(`prepare entry asset ${shortenUrl(url)}`)
    const entryReference = gerOrCreateReference(url, { type: "asset", isEntry: true })
    entryReferences[url] = entryReference
    await getAssetDependencies(url)
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    transformAsset(url)
  }

  const rollupChunkReadyCallbackMap = {}
  const registerCallbackOnceRollupChunkIsReady = (url, callback) => {
    rollupChunkReadyCallbackMap[url] = callback
  }

  const resolveAssetEntries = async (rollupBundle) => {
    Object.keys(rollupChunkReadyCallbackMap).forEach((key) => {
      const chunkName = Object.keys(rollupBundle).find(
        (bundleKey) => rollupBundle[bundleKey].facadeModuleId === key,
      )
      const chunk = rollupBundle[chunkName]
      logger.debug(`resolve rollup chunk ${shortenUrl(key)}`)
      rollupChunkReadyCallbackMap[key]({
        code: chunk.code,
        fileRelativeUrlForBundle: chunk.fileName,
      })
    })

    await Promise.all(
      Object.keys(entryReferences).map((assetEntryUrl) => {
        return getAssetReferenceId(assetEntryUrl)
      }),
    )
  }

  const getAssetReferenceId = memoizeAsyncByUrl(async (url, { source, importerUrl } = {}) => {
    const reference = gerOrCreateReference(url, { type: "asset", source, importerUrl })
    if (!reference.isConnected()) {
      throw new Error(`reference is not connected ${url}`)
    }
    await transformAsset(url)
    const { rollupReferenceId } = await reference.getReadyPromise()
    return rollupReferenceId
  })

  const referenceMap = {}
  const gerOrCreateReference = memoizeByUrl((url, { isEntry, type, source, importerUrl }) => {
    const reference = createReference(url, { isEntry, type, source, importerUrl })
    referenceMap[url] = reference
    if (source !== undefined) {
      setFileOriginalContent(url, source)
    }
    connectReference(reference)
    return reference
  })

  const loadAsset = memoizeAsyncByUrl(async (url) => {
    const assetSource = await load(url)
    const reference = referenceMap[url]
    reference.source = assetSource
  })
  const getAssetOriginalContent = async (url) => {
    await loadAsset(url)
    return referenceMap[url].source
  }
  const setFileOriginalContent = (url, source) => {
    referenceMap[url].source = source
    loadAsset.cache[url] = Promise.resolve()
  }

  const dependenciesMap = {}
  const assetTransformMap = {}
  const parseAsset = memoizeAsyncByUrl(async (url) => {
    const assetSource = await getAssetOriginalContent(url)
    const assetReference = referenceMap[url]

    // logger.debug(`${shortenUrl(url)} dependencies parsing starts`)
    const dependencies = []
    let previousJsReference
    const parseReturnValue = await parse(url, assetSource, {
      emitAssetReference: (assetUrlSpecifier, assetSource) => {
        const assetUrl = resolveUrl(assetUrlSpecifier, url)
        const assetReference = gerOrCreateReference(assetUrl, {
          type: "asset",
          importerUrl: url,
          source: assetSource,
        })
        if (assetReference.isConnected()) {
          dependencies.push(assetUrl)
          if (assetSource) {
            logger.debug(`found inline asset ${formatReferenceForLog(assetReference)}`)
          } else {
            logger.debug(`found asset ${formatReferenceForLog(assetReference)}`)
          }
        } else {
          logger.debug(`found external asset ${formatReferenceForLog(assetReference)} -> ignored`)
        }
        return assetUrl
      },
      emitJsReference: (jsUrlSpecifier, jsSource) => {
        // for now we can only emit a chunk from an entry file as visible in
        // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
        // https://github.com/rollup/rollup/issues/2872
        if (!assetReference.isEntry) {
          logger.warn(
            `cannot handle ${jsUrlSpecifier} found in ${url} because it's not yet supported by rollup`,
          )
          return null
        }

        const jsUrl = resolveUrl(jsUrlSpecifier, url)
        const jsReference = gerOrCreateReference(jsUrl, {
          type: "js",
          previousJsReference,
          importerUrl: url,
          source: jsSource,
        })
        if (jsReference.isConnected()) {
          previousJsReference = jsReference
          dependencies.push(jsUrl)
          if (jsSource) {
            logger.debug(`found inline js ${formatReferenceForLog(jsReference)}`)
          } else {
            logger.debug(`found js ${formatReferenceForLog(jsReference)}`)
          }
        } else {
          logger.debug(`found external js ${formatReferenceForLog(assetReference)} -> ignored`)
        }
        return jsUrl
      },
    })
    dependenciesMap[url] = dependencies
    if (dependencies.length > 0 && typeof parseReturnValue !== "function") {
      throw new Error(
        `parse has dependencies, it must return a function but received ${parseReturnValue}`,
      )
    }
    if (typeof parseReturnValue === "function") {
      assetTransformMap[url] = parseReturnValue
    }
    if (dependencies.length) {
      logger.debug(
        `${shortenUrl(url)} dependencies collected -> ${dependencies.map((url) =>
          shortenUrl(url),
        )}`,
      )
    }
  })
  const getAssetDependencies = async (url) => {
    await parseAsset(url)
    return dependenciesMap[url]
  }

  const transformAsset = memoizeAsyncByUrl(async (url) => {
    // la transformation d'un asset c'est avant tout la transformation de ses dépendances
    const assetDependencies = await getAssetDependencies(url)
    const urlMappings = {}
    await Promise.all(
      assetDependencies.map(async (dependencyUrl) => {
        const reference = referenceMap[dependencyUrl]
        logger.debug(`${shortenUrl(url)} waiting for ${shortenUrl(dependencyUrl)} to be ready`)
        await transformAsset(dependencyUrl)
        const { fileRelativeUrlForBundle } = await reference.getReadyPromise()
        // then put that information into the mappings
        urlMappings[reference.url] = fileRelativeUrlForBundle
      }),
    )

    // une fois que les dépendances sont transformées on peut transformer cet asset
    const assetContentBeforeTransformation = await getAssetOriginalContent(url)
    const reference = referenceMap[url]

    let assetContentAfterTransformation
    let assetFileRelativeUrlForBundle
    if (reference.type === "js") {
      logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(url)}`)
      const rollupChunkReadyPromise = new Promise((resolve) => {
        registerCallbackOnceRollupChunkIsReady(reference.url, resolve)
      })
      const { code, fileRelativeUrlForBundle } = await rollupChunkReadyPromise
      assetContentAfterTransformation = code
      assetFileRelativeUrlForBundle = fileRelativeUrlForBundle
    } else if (url in assetTransformMap) {
      const transform = assetTransformMap[url]
      // assetDependenciesMapping contains all dependencies for an asset
      // each key is the absolute url to the dependency file
      // each value is an url relative to the asset importing this dependency
      // it looks like this:
      // {
      //   "file:///project/coin.png": "./coin-45eiopri.png"
      // }
      // it must be used by transform to update url in the asset source
      const assetDependenciesMapping = {}
      const importerFileUrlForBundle = resolveUrl(
        computeFileRelativeUrlForBundle(url, ""),
        "file:///",
      )
      assetDependencies.forEach((dependencyUrl) => {
        // here it's guaranteed that dependencUrl is in urlMappings
        // because we throw in case there is circular deps
        // so each each dependency is handled one after an other
        // ensuring dependencies where already handled before
        const dependencyFileRelativeUrlForBundle = urlMappings[dependencyUrl]
        const dependencyFileUrlForBundle = resolveUrl(
          dependencyFileRelativeUrlForBundle,
          "file:///",
        )
        assetDependenciesMapping[dependencyUrl] = urlToRelativeUrl(
          dependencyFileUrlForBundle,
          importerFileUrlForBundle,
        )
      })
      logger.debug(
        `${shortenUrl(url)} transform starts to replace ${JSON.stringify(
          assetDependenciesMapping,
          null,
          "  ",
        )}`,
      )
      const transformReturnValue = await transform(assetDependenciesMapping, {
        computeFileRelativeUrlForBundle,
      })
      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`)
      }
      if (typeof transformReturnValue === "string") {
        assetContentAfterTransformation = transformReturnValue
      } else {
        const {
          code,
          // TODO: handle the map (it should end in rollup build)
          // map,
          fileRelativeUrlForBundle,
        } = transformReturnValue
        assetContentAfterTransformation = code
        assetFileRelativeUrlForBundle = fileRelativeUrlForBundle
      }
    } else {
      assetContentAfterTransformation = assetContentBeforeTransformation
    }

    reference.resolveTransformPromise({
      code: assetContentAfterTransformation,
      fileRelativeUrlForBundle: assetFileRelativeUrlForBundle,
    })
  })

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const formatReferenceForLog = ({ url, importerUrl }) => {
    if (importerUrl) {
      return `reference to ${shortenUrl(url)} in ${shortenUrl(importerUrl)}`
    }
    return `reference to ${shortenUrl(url)}`
  }

  return {
    prepareAssetEntry,
    resolveAssetEntries,
    getAssetReferenceId,
    inspect: () => {
      return {
        dependenciesMap,
        referenceMap,
      }
    },
  }
}

const memoizeAsyncByUrl = (fn) => {
  const urlCache = {}
  const memoized = async (url, ...args) => {
    if (url in urlCache) {
      return urlCache[url]
    }
    const promise = fn(url, ...args)
    urlCache[url] = promise
    return promise
  }
  memoized.cache = urlCache
  return memoized
}

const memoizeByUrl = (fn) => {
  const urlCache = {}
  return (url, ...args) => {
    if (url in urlCache) {
      return urlCache[url]
    }
    const promise = fn(url, ...args)
    urlCache[url] = promise
    return promise
  }
}

const createReference = (url, { isEntry = false, type, source, importerUrl }) => {
  let resolveTransformPromise
  const transformPromise = new Promise((res) => {
    resolveTransformPromise = ({ code, fileRelativeUrlForBundle }) => {
      res({ code, fileRelativeUrlForBundle })
    }
  })

  let readyPromise
  let connected = false
  const connect = (connectFn) => {
    connected = true
    readyPromise = Promise.resolve(connectFn({ transformPromise }))
    readyPromise.then(({ fileRelativeUrlForBundle }) => {
      reference.fileRelativeUrlForBundle = fileRelativeUrlForBundle
    })
  }

  const reference = {
    url,
    type,
    importerUrl,
    isEntry,
    isInline: source !== undefined,
    source,
    resolveTransformPromise,
    connect,
    isConnected: () => connected,
    getReadyPromise: () => readyPromise,
  }
  return reference
}
