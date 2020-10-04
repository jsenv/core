import { resolveUrl, urlIsInsideOf, urlToRelativeUrl } from "@jsenv/util"
import { computeFileUrlForCaching } from "./computeFileUrlForCaching.js"

export const createCompositeAssetHandler = (
  { load, parse },
  { projectDirectoryUrl, emitAsset = () => {} },
) => {
  const assetOriginalContentMap = {}
  const loadAsset = memoizeAsyncByUrl(async (url) => {
    const assetContent = await load(url)
    assetOriginalContentMap[url] = assetContent
  })
  const getAssetOriginalContent = async (url) => {
    await loadAsset(url)
    return assetOriginalContentMap[url]
  }

  const assetDependenciesMap = {}
  const assetTransformMap = {}
  const parseAsset = memoizeAsyncByUrl(async (url) => {
    const assetSource = await getAssetOriginalContent(url)

    const assetDependencies = []
    const parseReturnValue = await parse(url, assetSource, {
      emitAssetReference: (assetUrlRaw) => {
        const assetUrl = resolveUrl(assetUrlRaw, url)
        // already referenced, we care only once
        if (assetDependencies.includes(assetUrl)) {
          return
        }
        // ignore url outside project directory
        // a better version would console.warn about file url outside projectDirectoryUrl
        // and ignore them and console.info/debug about remote url (https, http, ...)
        if (!urlIsInsideOf(assetUrl, projectDirectoryUrl)) {
          return
        }
        assetDependencies.push(assetUrl)
      },
    })
    assetDependenciesMap[url] = assetDependencies
    if (assetDependencies.length > 0 && typeof parseReturnValue !== "function") {
      throw new Error(
        `parse has dependencies, it must return a function but received ${parseReturnValue}`,
      )
    }
    if (typeof parseReturnValue === "function") {
      assetTransformMap[url] = parseReturnValue
    }
  })
  const getAssetDependencies = async (url) => {
    await parseAsset(url)
    return assetDependenciesMap[url]
  }

  const assetContentMap = {}
  const assetUrlMappings = {}
  const transformAsset = memoizeAsyncByUrl(async (url) => {
    // la transformation d'un asset c'est avant tout la transformation de ses dépendances
    const assetDependencies = await getAssetDependencies(url)
    await Promise.all(
      assetDependencies.map(async (dependencyUrl) => {
        await transformAsset(dependencyUrl)
      }),
    )

    // une fois que les dépendances sont tansformées on peut transformer cet asset
    const assetContentBeforeTransformation = await getAssetOriginalContent(url)

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
        const dependencyUrlForCaching = assetUrlMappings[dependencyUrl]
        assetDependenciesMapping[dependencyUrl] = `./${urlToRelativeUrl(
          dependencyUrlForCaching,
          url,
        )}`
      })
      const transformReturnValue = await transform(assetDependenciesMapping, {
        computeFileUrlForCaching,
      })
      if (!transformReturnValue) {
        throw new Error(`transform must return an object {code, map}`)
      }

      const { code, map, urlForCaching } = transformReturnValue
      assetContentAfterTransformation = code
      assetUrlForCaching = urlForCaching || computeFileUrlForCaching(url, code)
      // TODO: handle the map (it should end in rollup build)
      console.log(map)
    } else {
      assetContentAfterTransformation = assetContentBeforeTransformation
      assetUrlForCaching = computeFileUrlForCaching(url, assetContentBeforeTransformation)
    }

    assetContentMap[url] = assetContentAfterTransformation
    assetUrlMappings[url] = assetUrlForCaching
  })

  const getAssetReferenceId = memoizeAsyncByUrl(async (url) => {
    await transformAsset(url)

    const assetContent = assetContentMap[url]
    const assetUrlForCaching = assetUrlMappings[url]
    return emitAsset(assetUrlForCaching, assetContent)
  })

  return {
    getAssetReferenceId,
    inspect: () => {
      return {
        assetOriginalContentMap,
        assetContentMap,
        assetUrlMappings,
      }
    },
  }
}

const memoizeAsyncByUrl = (fn) => {
  const urlCache = {}
  return async (url) => {
    if (url in urlCache) {
      return urlCache[url]
    }
    const promise = fn(url)
    urlCache[url] = promise
    return promise
  }
}
