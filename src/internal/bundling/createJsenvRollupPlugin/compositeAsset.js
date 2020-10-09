import { resolveUrl, urlToRelativeUrl, urlIsInsideOf } from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { computeFileNameForRollup } from "./computeFileNameForRollup.js"

const logger = createLogger({ logLevel: "debug" })

const assetFileNamePattern = "assets/[name]-[hash][extname]"

const computeAssetFileNameForRollup = (assetUrl, assetSource) => {
  return computeFileNameForRollup(assetUrl, assetSource, assetFileNamePattern)
}

export const createCompositeAssetHandler = (
  { load, parse },
  { projectDirectoryUrl = "file:///", connectReference = () => {} },
) => {
  const prepareAssetEntry = async (url, { fileNameForRollup }) => {
    logger.debug(`prepare entry asset ${shortenUrl(url)}`)
    const entryReference = getOrCreateReference(url, {
      type: "asset",
      isEntry: true,
      fileNameForRollup,
    })
    await entryReference.getDependenciesReadyPromise()
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    entryReference.getFileNameReadyPromise()
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
  }

  const getAssetReferenceIdForRollup = async (url, { source, importerUrl } = {}) => {
    const reference = getOrCreateReference(url, { type: "asset", source, importerUrl })
    if (!reference.isConnected()) {
      throw new Error(`reference is not connected ${url}`)
    }
    await reference.getRollupReferenceIdReadyPromise()
    return reference.rollupReferenceId
  }

  const referenceMap = {}
  const getOrCreateReference = memoizeByUrl((url, referenceData) => {
    const reference = createReference(url, referenceData)
    referenceMap[url] = reference
    connectReference(reference)
    return reference
  })

  const assetTransformMap = {}

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

  const createReference = (
    url,
    {
      importerUrl,
      isEntry = false,
      type,
      source,
      previousReference,
      sourceAfterTransformation,
      fileNameForRollup,
    },
  ) => {
    const getSourceReadyPromise = memoize(async () => {
      const source = await load(url)
      reference.source = source
    })
    if (source !== undefined) {
      getSourceReadyPromise.forceMemoization(source)
      reference.source = source
    }

    const getDependenciesReadyPromise = memoize(async () => {
      await getSourceReadyPromise()
      const referenceSource = reference.source
      const dependencies = []

      let previousJsReference
      const parseReturnValue = await parse(url, referenceSource, {
        emitAssetReference: (assetUrlSpecifier, assetSource) => {
          const assetUrl = resolveUrl(assetUrlSpecifier, url)
          const assetReference = getOrCreateReference(assetUrl, {
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
          if (!isEntry) {
            logger.warn(
              `cannot handle ${jsUrlSpecifier} found in ${url} because it's not yet supported by rollup`,
            )
            return null
          }

          const jsUrl = resolveUrl(jsUrlSpecifier, url)
          const jsReference = getOrCreateReference(jsUrl, {
            type: "js",
            previousReference: previousJsReference,
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
            logger.debug(`found external js ${formatReferenceForLog(reference)} -> ignored`)
          }
          return jsUrl
        },
      })
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

      reference.dependencies = dependencies
    })

    const getFileNameReadyPromise = memoize(async () => {
      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getDependenciesReadyPromise()
      const dependencies = reference.dependencies
      await Promise.all(
        dependencies.map(async (dependencyUrl) => {
          const dependencyReference = referenceMap[dependencyUrl]
          logger.debug(`${shortenUrl(url)} waiting for ${shortenUrl(dependencyUrl)} to be ready`)
          await dependencyReference.getFileNameReadyPromise()
        }),
      )

      // une fois que les dépendances sont transformées on peut transformer cet asset
      if (reference.type === "js") {
        logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(url)}`)
        const rollupChunkReadyPromise = new Promise((resolve) => {
          registerCallbackOnceRollupChunkIsReady(reference.url, resolve)
        })
        const { sourceAfterTransformation, fileNameForRollup } = await rollupChunkReadyPromise
        reference.sourceAfterTransformation = sourceAfterTransformation
        reference.fileNameForRollup = fileNameForRollup
        return
      }

      if (url in assetTransformMap) {
        const transform = assetTransformMap[url]
        // assetDependenciesMapping contains all dependencies for an asset
        // each key is the absolute url to the dependency file
        // each value is an url relative to the asset importing this dependency
        // it looks like this:
        // {
        //   "file:///project/coin.png": "./coin-45eiopri.png"
        // }
        // it must be used by transform to update url in the asset source
        const dependenciesMapping = {}
        const importerFileNameForRollup =
          reference.fileNameForRollup ||
          // we don't yet know the exact importerFileNameForRollup but we can generate a fake one
          // to ensure we resolve dependency against where the importer file will be
          computeAssetFileNameForRollup(reference.url, "")
        dependencies.forEach((dependencyUrl) => {
          const dependencyReference = referenceMap[dependencyUrl]
          // here it's guaranteed that dependencUrl is in urlMappings
          // because we throw in case there is circular deps
          // so each each dependency is handled one after an other
          // ensuring dependencies where already handled before
          const dependencyFileNameForRollup = dependencyReference.fileNameForRollup
          const dependencyFileUrlForRollup = resolveUrl(dependencyFileNameForRollup, "file:///")
          const importerFileUrlForRollup = resolveUrl(importerFileNameForRollup, "file:///")
          dependenciesMapping[dependencyUrl] = urlToRelativeUrl(
            dependencyFileUrlForRollup,
            importerFileUrlForRollup,
          )
        })
        logger.debug(
          `${shortenUrl(url)} transform starts to replace ${JSON.stringify(
            dependenciesMapping,
            null,
            "  ",
          )}`,
        )
        const transformReturnValue = await transform(dependenciesMapping, {
          precomputeFileNameForRollup: (sourceAfterTransformation) =>
            computeAssetFileNameForRollup(url, sourceAfterTransformation),
        })
        if (transformReturnValue === null || transformReturnValue === undefined) {
          throw new Error(`transform must return an object {code, map}`)
        }

        let sourceAfterTransformation
        let fileNameForRollup = reference.fileNameForRollup
        if (typeof transformReturnValue === "string") {
          sourceAfterTransformation = transformReturnValue
        } else {
          sourceAfterTransformation = transformReturnValue.sourceAfterTransformation
          if (transformReturnValue.fileNameForRollup) {
            fileNameForRollup = transformReturnValue.fileNameForRollup
          }
          if (transformReturnValue.map) {
            reference.map = transformReturnValue.map
          }
        }

        if (fileNameForRollup === undefined) {
          fileNameForRollup = computeAssetFileNameForRollup(
            reference.url,
            sourceAfterTransformation,
          )
        }

        reference.sourceAfterTransformation = sourceAfterTransformation
        reference.fileNameForRollup = fileNameForRollup
        return
      }

      reference.sourceAfterTransformation = reference.source
      reference.fileNameForRollup = computeAssetFileNameForRollup(reference.url, reference.source)
    })

    let connected = false
    const connect = memoize(async (connectFn) => {
      connected = true
      const { rollupReferenceId } = await connectFn()
      reference.rollupReferenceId = rollupReferenceId
    })

    const getRollupReferenceIdReadyPromise = () => connect()

    const reference = {
      url,
      type,
      importerUrl,
      isEntry,
      isInline: source !== undefined,
      source,
      sourceAfterTransformation,
      fileNameForRollup,

      previousReference,

      connect,
      isConnected: () => connected,

      getSourceReadyPromise,
      getDependenciesReadyPromise,
      getFileNameReadyPromise,
      getRollupReferenceIdReadyPromise,
    }
    return reference
  }

  return {
    prepareAssetEntry,
    resolveJsReferencesUsingRollupBundle,
    getAssetReferenceIdForRollup,
    inspect: () => {
      return {
        referenceMap,
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
