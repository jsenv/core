import { urlToRelativeUrl } from "@jsenv/urls"

import { urlSpecifierEncoding } from "./url_specifier_encoding.js"

export const createUrlGraph = () => {
  const createUrlInfoCallbackRef = { current: () => {} }
  const prunedUrlInfosCallbackRef = { current: () => {} }

  const urlInfoMap = new Map()
  const getUrlInfo = (url) => urlInfoMap.get(url)
  const deleteUrlInfo = (url) => {
    const urlInfo = urlInfoMap.get(url)
    if (urlInfo) {
      urlInfoMap.delete(url)
      urlInfo.dependencies.forEach((dependencyUrl) => {
        getUrlInfo(dependencyUrl).dependents.delete(url)
      })
      if (urlInfo.sourcemapReference) {
        deleteUrlInfo(urlInfo.sourcemapReference.url)
      }
    }
  }
  const reuseOrCreateUrlInfo = (url) => {
    const existingUrlInfo = getUrlInfo(url)
    if (existingUrlInfo) return existingUrlInfo
    const urlInfo = createUrlInfo(url)
    urlInfoMap.set(url, urlInfo)
    createUrlInfoCallbackRef.current(urlInfo)
    return urlInfo
  }
  const getParentIfInline = (urlInfo) => {
    return urlInfo.isInline ? getUrlInfo(urlInfo.inlineUrlSite.url) : urlInfo
  }

  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl)
    if (!parentUrlInfo) {
      return null
    }
    const seen = []
    const search = (urlInfo) => {
      const firstReferenceFound = urlInfo.references.find((reference) => {
        return urlSpecifierEncoding.decode(reference) === specifier
      })
      if (firstReferenceFound) {
        return firstReferenceFound
      }
      for (const dependencyUrl of parentUrlInfo.dependencies) {
        if (seen.includes(dependencyUrl)) {
          continue
        }
        seen.push(dependencyUrl)
        const dependencyUrlInfo = getUrlInfo(dependencyUrl)
        if (dependencyUrlInfo.isInline) {
          const firstRef = search(dependencyUrlInfo)
          if (firstRef) {
            return firstRef
          }
        }
      }
      return null
    }
    return search(parentUrlInfo)
  }
  const findDependent = (urlInfo, visitor) => {
    const seen = [urlInfo.url]
    let found = null
    const iterate = (currentUrlInfo) => {
      for (const dependentUrl of currentUrlInfo.dependents) {
        if (seen.includes(dependentUrl)) {
          continue
        }
        if (found) {
          break
        }
        seen.push(dependentUrl)
        const dependentUrlInfo = getUrlInfo(dependentUrl)
        if (visitor(dependentUrlInfo)) {
          found = dependentUrlInfo
        }
        if (found) {
          break
        }
        iterate(dependentUrlInfo)
      }
    }
    iterate(urlInfo)
    return found
  }

  const updateReferences = (urlInfo, references) => {
    const setOfDependencyUrls = new Set()
    const setOfImplicitUrls = new Set()
    references.forEach((reference) => {
      if (reference.isResourceHint) {
        // resource hint are a special kind of reference.
        // They are a sort of weak reference to an url.
        // We ignore them so that url referenced only by resource hints
        // have url.dependents.size === 0 and can be considered as not used
        // It means html won't consider url referenced solely
        // by <link> as dependency and it's fine
        return
      }
      const dependencyUrl = reference.url
      setOfDependencyUrls.add(dependencyUrl)
      // an implicit reference do not appear in the file but a non-explicited file have an impact on it
      // (package.json on import resolution for instance)
      // in that case:
      // - file depends on the implicit file (it must autoreload if package.json is modified)
      // - cache validity for the file depends on the implicit file (it must be re-cooked in package.json is modified)
      if (reference.isImplicit) {
        setOfImplicitUrls.add(dependencyUrl)
      }
    })
    setOfDependencyUrls.forEach((dependencyUrl) => {
      urlInfo.dependencies.add(dependencyUrl)
      const dependencyUrlInfo = reuseOrCreateUrlInfo(dependencyUrl)
      dependencyUrlInfo.dependents.add(urlInfo.url)
    })
    setOfImplicitUrls.forEach((implicitUrl) => {
      urlInfo.implicitUrls.add(implicitUrl)
      if (urlInfo.isInline) {
        const parentUrlInfo = getUrlInfo(urlInfo.inlineUrlSite.url)
        parentUrlInfo.implicitUrls.add(implicitUrl)
      }
    })
    const prunedUrlInfos = []
    const pruneDependency = (urlInfo, urlToClean) => {
      urlInfo.dependencies.delete(urlToClean)
      const dependencyUrlInfo = getUrlInfo(urlToClean)
      if (!dependencyUrlInfo) {
        return
      }
      dependencyUrlInfo.dependents.delete(urlInfo.url)
      if (dependencyUrlInfo.dependents.size === 0) {
        dependencyUrlInfo.dependencies.forEach((dependencyUrl) => {
          pruneDependency(dependencyUrlInfo, dependencyUrl)
        })
        prunedUrlInfos.push(dependencyUrlInfo)
      }
    }
    urlInfo.dependencies.forEach((dependencyUrl) => {
      if (!setOfDependencyUrls.has(dependencyUrl)) {
        pruneDependency(urlInfo, dependencyUrl)
      }
    })
    if (prunedUrlInfos.length) {
      prunedUrlInfos.forEach((prunedUrlInfo) => {
        prunedUrlInfo.modifiedTimestamp = Date.now()
        if (prunedUrlInfo.isInline) {
          // should we always delete?
          deleteUrlInfo(prunedUrlInfo.url)
        }
      })
      prunedUrlInfosCallbackRef.current(prunedUrlInfos, urlInfo)
    }
    urlInfo.implicitUrls.forEach((implicitUrl) => {
      if (!setOfDependencyUrls.has(implicitUrl)) {
        let implicitUrlComesFromInlineContent = false
        for (const dependencyUrl of urlInfo.dependencies) {
          const dependencyUrlInfo = getUrlInfo(dependencyUrl)
          if (
            dependencyUrlInfo.isInline &&
            dependencyUrlInfo.implicitUrls.has(implicitUrl)
          ) {
            implicitUrlComesFromInlineContent = true
            break
          }
        }
        if (!implicitUrlComesFromInlineContent) {
          urlInfo.implicitUrls.delete(implicitUrl)
        }
        if (urlInfo.isInline) {
          const parentUrlInfo = getUrlInfo(urlInfo.inlineUrlSite.url)
          parentUrlInfo.implicitUrls.delete(implicitUrl)
        }
      }
    })
    urlInfo.references = references
    return urlInfo
  }

  const considerModified = (urlInfo, modifiedTimestamp = Date.now()) => {
    const seen = []
    const iterate = (urlInfo) => {
      if (seen.includes(urlInfo.url)) {
        return
      }
      seen.push(urlInfo.url)
      urlInfo.modifiedTimestamp = modifiedTimestamp
      urlInfo.originalContentEtag = undefined
      urlInfo.contentEtag = undefined
      urlInfo.dependents.forEach((dependentUrl) => {
        const dependentUrlInfo = getUrlInfo(dependentUrl)
        const { hotAcceptDependencies = [] } = dependentUrlInfo.data
        if (!hotAcceptDependencies.includes(urlInfo.url)) {
          iterate(dependentUrlInfo)
        }
      })
      urlInfo.dependencies.forEach((dependencyUrl) => {
        const dependencyUrlInfo = getUrlInfo(dependencyUrl)
        if (dependencyUrlInfo.isInline) {
          iterate(dependencyUrlInfo)
        }
      })
    }
    iterate(urlInfo)
  }

  return {
    createUrlInfoCallbackRef,
    prunedUrlInfosCallbackRef,

    urlInfoMap,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    getParentIfInline,

    inferReference,
    updateReferences,
    considerModified,
    findDependent,

    toObject: () => {
      const data = {}
      urlInfoMap.forEach((urlInfo) => {
        data[urlInfo.url] = urlInfo
      })
      return data
    },
    toJSON: (rootDirectoryUrl) => {
      const data = {}
      urlInfoMap.forEach((urlInfo) => {
        const dependencyUrls = Array.from(urlInfo.dependencies)
        if (dependencyUrls.length) {
          const relativeUrl = urlToRelativeUrl(urlInfo.url, rootDirectoryUrl)
          data[relativeUrl] = dependencyUrls.map((dependencyUrl) =>
            urlToRelativeUrl(dependencyUrl, rootDirectoryUrl),
          )
        }
      })
      return data
    },
  }
}

const createUrlInfo = (url) => {
  const urlInfo = {
    error: null,
    modifiedTimestamp: 0,
    originalContentEtag: null,
    contentEtag: null,
    isWatched: false,
    isValid: () => false,
    data: {}, // plugins can put whatever they want here
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
    implicitUrls: new Set(),
    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    typeHint: undefined,
    subtypeHint: undefined,
    contentType: "", // "text/html", "text/css", "text/javascript", "application/json", ...
    url,
    originalUrl: undefined,
    filename: "",
    isEntryPoint: false,
    shouldHandle: undefined,
    originalContent: undefined,
    content: undefined,

    sourcemap: null,
    sourcemapReference: null,
    sourcemapIsWrong: false,

    generatedUrl: null,
    sourcemapGeneratedUrl: null,
    injected: false,

    isInline: false,
    inlineUrlSite: null,
    jsQuote: null, // maybe move to inlineUrlSite?

    timing: {},
    headers: {},
    debug: false,
  }
  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo
}
