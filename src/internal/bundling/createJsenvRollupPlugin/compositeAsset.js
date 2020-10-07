import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { computeFileUrlForCaching } from "./computeFileUrlForCaching.js"

const logger = createLogger({ logLevel: "debug" })

export const createCompositeAssetHandler = (
  { load, parse },
  { projectDirectoryUrl = "file:///", connectReference = () => {} },
) => {
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
  const gerOrCreateReference = memoizeByUrl((url, { type, source, importerUrl }) => {
    if (importerUrl) {
      logger.debug(
        `${urlToRelativeUrl(url, projectDirectoryUrl)} referenced by ${urlToRelativeUrl(
          importerUrl,
          projectDirectoryUrl,
        )}`,
      )
    } else {
      logger.debug(`${urlToRelativeUrl(url, projectDirectoryUrl)} referenced by some js file`)
    }

    let resolveTransformPromise
    const transformPromise = new Promise((res) => {
      resolveTransformPromise = ({ code, urlForCaching }) => {
        logger.debug(`${urlToRelativeUrl(url, projectDirectoryUrl)} transformed`)
        res({ code, urlForCaching })
      }
    })

    let readyPromise
    let connected = false
    const connect = (connectFn) => {
      connected = true
      readyPromise = Promise.resolve(connectFn({ transformPromise }))
      readyPromise.then(({ rollupReferenceId, urlForCaching }) => {
        logger.debug(`${urlToRelativeUrl(url, projectDirectoryUrl)} ready
--- rollup reference id ---
${rollupReferenceId}
--- url for caching ---
${urlToRelativeUrl(urlForCaching, projectDirectoryUrl)}`)
      })
    }

    if (source) {
      setFileOriginalContent(url, source)
    }

    const reference = {
      url,
      type,
      importerUrl,
      resolveTransformPromise,
      connect,
      isConnected: () => connected,
      getReadyPromise: () => readyPromise,
    }
    referenceMap[url] = reference
    connectReference(reference)
    return reference
  })

  const originalContentMap = {}
  const loadAsset = memoizeAsyncByUrl(async (url) => {
    // pour les assets inline il faudra un logique pour retourner direct la valeur
    logger.debug(`${urlToRelativeUrl(url, projectDirectoryUrl)} load starts`)
    const assetContent = await load(url)
    logger.debug(`${urlToRelativeUrl(url, projectDirectoryUrl)} load ends`)
    originalContentMap[url] = assetContent
  })
  const getAssetOriginalContent = async (url) => {
    await loadAsset(url)
    return originalContentMap[url]
  }
  const setFileOriginalContent = (url, source) => {
    originalContentMap[url] = source
    loadAsset.cache[url] = Promise.resolve()
  }

  const dependenciesMap = {}
  const assetTransformMap = {}
  const parseAsset = memoizeAsyncByUrl(async (url) => {
    const assetSource = await getAssetOriginalContent(url)

    logger.debug(`${urlToRelativeUrl(url, projectDirectoryUrl)} dependencies parsing starts`)
    const dependencies = []
    let previousJsReference
    const parseReturnValue = await parse(url, assetSource, {
      emitAssetReference: (assetUrlRaw, assetSource) => {
        const assetUrl = resolveUrl(assetUrlRaw, url)
        const assetReference = gerOrCreateReference(assetUrl, {
          type: "asset",
          importerUrl: url,
          source: assetSource,
        })
        if (assetReference.isConnected()) {
          dependencies.push(assetUrl)
        }
      },
      emitJsReference: (jsUrlRaw, jsSource) => {
        const jsUrl = resolveUrl(jsUrlRaw, url)
        const jsReference = gerOrCreateReference(jsUrl, {
          type: "js",
          previousJsReference,
          importerUrl: url,
          source: jsSource,
        })
        if (jsReference.isConnected()) {
          previousJsReference = jsReference
          dependencies.push(jsUrl)
        }
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
    logger.debug(
      `${urlToRelativeUrl(
        url,
        projectDirectoryUrl,
      )} dependencies parsed -> ${dependencies.map((url) =>
        urlToRelativeUrl(url, projectDirectoryUrl),
      )}`,
    )
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
        if (reference.type === "js") {
          // rollup will produce this chunk and call resolveReadyPromise
        } else {
          // parse and transform this asset
          await transformAsset(dependencyUrl)
        }

        const { urlForCaching } = await reference.getReadyPromise()
        // then put that information into the mappings
        urlMappings[reference.url] = urlForCaching
      }),
    )

    // une fois que les dépendances sont transformées on peut transformer cet asset
    const assetContentBeforeTransformation = await getAssetOriginalContent(url)
    const reference = referenceMap[url]

    let assetContentAfterTransformation
    let assetUrlForCaching
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
      const assetDependenciesMapping = {}
      assetDependencies.forEach((dependencyUrl) => {
        // here it's guaranteed that dependencUrl is in assetUrlMappings
        // because we throw in case there is circular deps
        // so each each dependency is handled one after an other
        // ensuring dependencies where already handled before
        const dependencyUrlForCaching = urlMappings[dependencyUrl]
        assetDependenciesMapping[dependencyUrl] = `./${urlToRelativeUrl(
          dependencyUrlForCaching,
          url,
        )}`
      })
      logger.debug(
        `${urlToRelativeUrl(
          url,
          projectDirectoryUrl,
        )} transform starts to replace ${assetDependenciesMapping}`,
      )
      const transformReturnValue = await transform(assetDependenciesMapping, {
        computeFileUrlForCaching,
      })
      if (!transformReturnValue) {
        throw new Error(`transform must return an object {code, map}`)
      }

      const {
        code,
        // TODO: handle the map (it should end in rollup build)
        // map,
        urlForCaching,
      } = transformReturnValue
      assetContentAfterTransformation = code
      assetUrlForCaching = urlForCaching
    } else {
      assetContentAfterTransformation = assetContentBeforeTransformation
    }

    reference.resolveTransformPromise({
      code: assetContentAfterTransformation,
      urlForCaching: assetUrlForCaching,
    })
  })

  return {
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
