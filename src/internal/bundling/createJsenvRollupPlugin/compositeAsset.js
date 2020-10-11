import {
  resolveUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  isFileSystemPath,
  fileSystemPathToUrl,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { computeFileNameForRollup } from "./computeFileNameForRollup.js"

const logger = createLogger({ logLevel: "debug" })

const assetFileNamePattern = "assets/[name]-[hash][extname]"

const computeAssetFileNameForRollup = (assetUrl, assetSource) => {
  return computeFileNameForRollup(assetUrl, assetSource, assetFileNamePattern)
}

export const createCompositeAssetHandler = (
  { load, parse },
  { projectDirectoryUrl = "file:///", connectTarget = () => {} },
) => {
  const prepareAssetEntry = async (url, { fileNameForRollup }) => {
    logger.debug(`prepare entry asset ${shortenUrl(url)}`)

    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation()
    const [, entryTarget] = createReference(callerLocation, {
      isEntry: true,
      url,
      type: "asset",
      fileNameForRollup,
    })

    await entryTarget.getDependenciesReadyPromise()
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    entryTarget.getFileNameReadyPromise()
  }

  const targetMap = {}
  const createReference = (referenceData, targetData) => {
    const { url } = targetData

    if (url in targetMap) {
      const target = targetMap[url]
      const reference = { target, ...referenceData }
      target.references.push(reference)
      return [reference, target]
    }

    const target = createTarget(targetData)
    const reference = { target, ...referenceData }
    target.references.push(reference)
    targetMap[url] = target
    connectTarget(target)
    return [reference, target]
  }

  const assetTransformMap = {}
  const createTarget = ({
    url,
    isEntry = false,
    type,
    source,
    sourceAfterTransformation,
    fileNameForRollup,
    references = [],
  }) => {
    const target = {
      url,
      type,
      source,
      sourceAfterTransformation,
      fileNameForRollup,
      references,
    }

    const getSourceReadyPromise = memoize(async () => {
      const source = await load(url)
      target.source = source
    })
    if (source !== undefined) {
      getSourceReadyPromise.forceMemoization(source)
    }

    const getDependenciesReadyPromise = memoize(async () => {
      await getSourceReadyPromise()
      const dependencies = []

      let previousJsReference
      const parseReturnValue = await parse(url, target.source, {
        emitAssetReference: ({ specifier, column, line, source }) => {
          const assetUrl = resolveUrl(specifier, url)
          const [assetReference, assetTarget] = createReference(
            { url, column, line },
            { url: assetUrl, type: "asset", source },
          )
          if (assetTarget.isConnected()) {
            dependencies.push(assetUrl)
            if (source) {
              logger.debug(`found inline asset ${formatReferenceForLog(assetReference)}`)
            } else {
              logger.debug(`found asset ${formatReferenceForLog(assetReference)}`)
            }
          } else {
            logger.debug(`found external asset ${formatReferenceForLog(assetReference)} -> ignored`)
          }
          return assetUrl
        },
        emitJsReference: ({ specifier, column, line, source }) => {
          // for now we can only emit a chunk from an entry file as visible in
          // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
          // https://github.com/rollup/rollup/issues/2872
          if (!isEntry) {
            logger.warn(
              `cannot handle ${specifier} found in ${url} because it's not yet supported by rollup`,
            )
            return null
          }

          const jsUrl = resolveUrl(specifier, url)
          const [jsReference, jsTarget] = createReference(
            { url, column, line, previousJsReference },
            { url: jsUrl, type: "js", source },
          )
          if (jsTarget.isConnected()) {
            previousJsReference = jsReference
            dependencies.push(jsUrl)
            if (source) {
              logger.debug(`found inline js ${formatReferenceForLog(jsReference)}`)
            } else {
              logger.debug(`found js ${formatReferenceForLog(jsReference)}`)
            }
          } else {
            logger.debug(`found external js ${formatReferenceForLog(jsReference)} -> ignored`)
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

      target.dependencies = dependencies
    })

    const getFileNameReadyPromise = memoize(async () => {
      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getDependenciesReadyPromise()
      const dependencies = target.dependencies
      await Promise.all(
        dependencies.map(async (dependencyUrl) => {
          const dependencyTarget = targetMap[dependencyUrl]
          logger.debug(`${shortenUrl(url)} waiting for ${shortenUrl(dependencyUrl)} to be ready`)
          await dependencyTarget.getFileNameReadyPromise()
        }),
      )

      // une fois que les dépendances sont transformées on peut transformer cet asset
      if (target.type === "js") {
        logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(url)}`)
        const rollupChunkReadyPromise = new Promise((resolve) => {
          registerCallbackOnceRollupChunkIsReady(target.url, resolve)
        })
        const { sourceAfterTransformation, fileNameForRollup } = await rollupChunkReadyPromise
        target.sourceAfterTransformation = sourceAfterTransformation
        target.fileNameForRollup = fileNameForRollup
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
          target.fileNameForRollup ||
          // we don't yet know the exact importerFileNameForRollup but we can generate a fake one
          // to ensure we resolve dependency against where the importer file will be
          computeAssetFileNameForRollup(target.url, "")
        dependencies.forEach((dependencyUrl) => {
          const dependencyTarget = targetMap[dependencyUrl]
          // here it's guaranteed that dependencUrl is in urlMappings
          // because we throw in case there is circular deps
          // so each each dependency is handled one after an other
          // ensuring dependencies where already handled before
          const dependencyFileNameForRollup = dependencyTarget.fileNameForRollup
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
        let fileNameForRollup = target.fileNameForRollup
        if (typeof transformReturnValue === "string") {
          sourceAfterTransformation = transformReturnValue
        } else {
          sourceAfterTransformation = transformReturnValue.sourceAfterTransformation
          if (transformReturnValue.fileNameForRollup) {
            fileNameForRollup = transformReturnValue.fileNameForRollup
          }
          if (transformReturnValue.map) {
            target.map = transformReturnValue.map
          }
        }

        if (fileNameForRollup === undefined) {
          fileNameForRollup = computeAssetFileNameForRollup(target.url, sourceAfterTransformation)
        }

        target.sourceAfterTransformation = sourceAfterTransformation
        target.fileNameForRollup = fileNameForRollup
        return
      }

      target.sourceAfterTransformation = target.source
      target.fileNameForRollup = computeAssetFileNameForRollup(target.url, target.source)
    })

    let connected = false
    const connect = memoize(async (connectFn) => {
      connected = true
      const { rollupReferenceId } = await connectFn()
      target.rollupReferenceId = rollupReferenceId
    })

    const getRollupReferenceIdReadyPromise = () => connect()

    Object.assign(target, {
      connect,
      isConnected: () => connected,
      createReference,

      getSourceReadyPromise,
      getDependenciesReadyPromise,
      getFileNameReadyPromise,
      getRollupReferenceIdReadyPromise,
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
  }

  const generateJavaScriptForAssetImport = async (url, { source, importerUrl } = {}) => {
    const [, assetTarget] = createReference(
      // the reference to this target comes from importerUrl
      // but we don't really know the line and column
      // because rollup does not share this information
      {
        url: importerUrl,
        column: undefined,
        line: undefined,
      },
      {
        url,
        type: "asset",
        source,
      },
    )

    if (!assetTarget.isConnected()) {
      throw new Error(`target is not connected ${url}`)
    }
    await assetTarget.getRollupReferenceIdReadyPromise()
    const { rollupReferenceId } = assetTarget
    return `export default import.meta.ROLLUP_FILE_URL_${rollupReferenceId};`
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const formatReferenceForLog = ({ url, importer }) => {
    if (importer) {
      return `reference to ${shortenUrl(url)} in ${shortenUrl(importer.url)}`
    }
    return `reference to ${shortenUrl(url)}`
  }

  const getFileSource = (url) => {
    return url in targetMap ? targetMap[url].source : null
  }

  return {
    prepareAssetEntry,
    resolveJsReferencesUsingRollupBundle,
    generateJavaScriptForAssetImport,
    getFileSource,
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
  const callerCallsite = stack[stack.length - 2]
  const fileName = callerCallsite.getFileName()
  return {
    url: isFileSystemPath(fileName) ? fileSystemPathToUrl(fileName) : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  }
}
