import { resolveUrl, urlIsInsideOf, urlToRelativeUrl } from "@jsenv/util"
import { computeFileUrlForCaching } from "./computeFileUrlForCaching.js"

export const createCompositeAssetHandler = (
  { load, parse, transform },
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
  const parseAsset = memoizeAsyncByUrl(async (url) => {
    const assetSource = await getAssetOriginalContent(url)

    const assetDependencies = []
    await parse(url, assetSource, {
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
    const transformReturnValue = await transform(
      url,
      assetContentBeforeTransformation,
      assetDependenciesMapping,
    )
    if (transformReturnValue === undefined) {
      throw new Error(`transform must return null or {code, map}`)
    }
    let assetContentAfterTransformation
    if (transformReturnValue === null) {
      assetContentAfterTransformation = assetContentBeforeTransformation
    } else {
      const { code, map } = transformReturnValue
      assetContentAfterTransformation = code
      // TODO: handle the map (output it, maybe also some url to relocate)
      // on verra plus tard parce que c'est délicat
      // ptet fournir une api externe pour mettre a jour le css et le fichier map
      console.log(map)
    }
    assetContentMap[url] = assetContentAfterTransformation
    assetUrlMappings[url] = computeFileUrlForCaching(url, assetContentAfterTransformation)
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
