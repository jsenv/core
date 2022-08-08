import { urlToRelativeUrl } from "@jsenv/urls"
import { urlSpecifierEncoding } from "./url_specifier_encoding.js"

export const createUrlGraph = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
  onCreateUrlInfo = () => {},
  includeOriginalUrls,
} = {}) => {
  const urlInfoMap = new Map()
  const getUrlInfo = (url) => urlInfoMap.get(url)
  const deleteUrlInfo = (url) => {
    const urlInfo = urlInfoMap.get(url)
    if (urlInfo) {
      urlInfoMap.delete(url)
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
    onCreateUrlInfo(urlInfo)
    return urlInfo
  }
  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl)
    if (!parentUrlInfo) {
      return null
    }
    const firstReferenceOnThatUrl = parentUrlInfo.references.find(
      (reference) => {
        return urlSpecifierEncoding.decode(reference) === specifier
      },
    )
    return firstReferenceOnThatUrl
  }
  const findDependent = (url, predicate) => {
    const urlInfo = getUrlInfo(url)
    if (!urlInfo) {
      return null
    }
    const visitDependents = (urlInfo) => {
      for (const dependentUrl of urlInfo.dependents) {
        const dependent = getUrlInfo(dependentUrl)
        if (predicate(dependent)) {
          return dependent
        }
        return visitDependents(dependent)
      }
      return null
    }
    return visitDependents(urlInfo)
  }

  const updateReferences = (urlInfo, references) => {
    const setOfDependencyUrls = new Set()

    // for import assertion "file.css?as_css_module" depends on "file.css"
    // this is enabled only for dev where there is autoreload
    // during build the css file must be considered as not referenced
    // (except if referenced explicitely by something else) so that
    // the css file does not appear in the build directory
    if (includeOriginalUrls && urlInfo.originalUrl !== urlInfo.url) {
      setOfDependencyUrls.add(urlInfo.originalUrl)
    }

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
      setOfDependencyUrls.add(reference.urlInfoUrl || reference.url)
    })
    const urlsToRemove = Array.from(urlInfo.dependencies).filter(
      (dep) => !setOfDependencyUrls.has(dep),
    )
    pruneDependencies(urlInfo, urlsToRemove)
    urlInfo.references = references
    setOfDependencyUrls.forEach((dependencyUrl) => {
      const dependencyUrlInfo = reuseOrCreateUrlInfo(dependencyUrl)
      urlInfo.dependencies.add(dependencyUrl)
      dependencyUrlInfo.dependents.add(urlInfo.url)
    })
    return urlInfo
  }
  const pruneDependencies = (firstUrlInfo, urlsToRemove) => {
    const prunedUrlInfos = []
    const removeDependencies = (urlInfo, urlsToPrune) => {
      urlsToPrune.forEach((urlToPrune) => {
        urlInfo.dependencies.delete(urlToPrune)
        const dependencyUrlInfo = getUrlInfo(urlToPrune)
        if (!dependencyUrlInfo) {
          return
        }
        dependencyUrlInfo.dependents.delete(urlInfo.url)
        if (dependencyUrlInfo.dependents.size === 0) {
          removeDependencies(
            dependencyUrlInfo,
            Array.from(dependencyUrlInfo.dependencies),
          )
          prunedUrlInfos.push(dependencyUrlInfo)
        }
      })
    }
    removeDependencies(firstUrlInfo, urlsToRemove)
    if (prunedUrlInfos.length === 0) {
      return
    }
    prunedUrlInfos.forEach((prunedUrlInfo) => {
      prunedUrlInfo.modifiedTimestamp = Date.now()
      if (prunedUrlInfo.isInline) {
        // should we always delete?
        deleteUrlInfo(prunedUrlInfo.url)
      }
    })
    if (clientFilesPruneCallbackList) {
      clientFilesPruneCallbackList.forEach((callback) => {
        callback({
          firstUrlInfo,
          prunedUrlInfos,
        })
      })
    }
  }

  if (clientFileChangeCallbackList) {
    clientFileChangeCallbackList.push(({ url }) => {
      const urlInfo = getUrlInfo(url)
      if (urlInfo) {
        considerModified(urlInfo, Date.now())
      }
    })
  }

  const considerModified = (urlInfo, modifiedTimestamp = Date.now()) => {
    const seen = []
    const iterate = (urlInfo) => {
      if (seen.includes(urlInfo.url)) {
        return
      }
      seen.push(urlInfo.url)
      urlInfo.modifiedTimestamp = modifiedTimestamp
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

  const getRelatedUrlInfos = (url) => {
    const urlInfosUntilNotInline = []
    const parentUrlInfo = getUrlInfo(url)
    if (parentUrlInfo) {
      urlInfosUntilNotInline.push(parentUrlInfo)
      if (parentUrlInfo.inlineUrlSite) {
        urlInfosUntilNotInline.push(
          ...getRelatedUrlInfos(parentUrlInfo.inlineUrlSite.url),
        )
      }
    }
    return urlInfosUntilNotInline
  }

  return {
    urlInfoMap,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    inferReference,
    findDependent,
    updateReferences,
    considerModified,
    getRelatedUrlInfos,

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
    contentEtag: null,
    dependsOnPackageJson: false,
    isValid,
    data: {}, // plugins can put whatever they want here
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
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

    isInline: false,
    inlineUrlSite: null,
    jsQuote: null, // maybe move to inlineUrlSite?

    timing: {},
    headers: {},
  }
  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo
}

const isValid = () => false
