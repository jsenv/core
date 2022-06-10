import { urlToRelativeUrl } from "@jsenv/filesystem"
import { urlSpecifierEncoding } from "./url_specifier_encoding.js"

export const createUrlGraph = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
} = {}) => {
  const urlInfos = {}
  const getUrlInfo = (url) => urlInfos[url]
  const deleteUrlInfo = (url) => {
    const urlInfo = urlInfos[url]
    if (urlInfo) {
      delete urlInfos[url]
      if (urlInfo.sourcemapReference) {
        deleteUrlInfo(urlInfo.sourcemapReference.url)
      }
    }
  }

  const reuseOrCreateUrlInfo = (url) => {
    const existingUrlInfo = urlInfos[url]
    if (existingUrlInfo) return existingUrlInfo
    const urlInfo = createUrlInfo(url)
    urlInfos[url] = urlInfo
    return urlInfo
  }
  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = urlInfos[parentUrl]
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
    const urlInfo = urlInfos[url]
    if (!urlInfo) {
      return null
    }
    const visitDependents = (urlInfo) => {
      for (const dependentUrl of urlInfo.dependents) {
        const dependent = urlInfos[dependentUrl]
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
    const dependencyUrls = []
    references.forEach((reference) => {
      if (reference.isRessourceHint) {
        // ressource hint are a special kind of reference.
        // They are a sort of weak reference to an url.
        // We ignore them so that url referenced only by ressource hints
        // have url.dependents.size === 0 and can be considered as not used
        // It means html won't consider url referenced solely
        // by <link> as dependency and it's fine
        return
      }
      if (dependencyUrls.includes(reference.url)) {
        return
      }
      dependencyUrls.push(reference.url)
    })
    pruneDependencies(
      urlInfo,
      Array.from(urlInfo.dependencies).filter(
        (dep) => !dependencyUrls.includes(dep),
      ),
    )
    urlInfo.references = references
    dependencyUrls.forEach((dependencyUrl) => {
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
        const dependency = urlInfos[urlToPrune]
        if (!dependency) {
          return
        }
        dependency.dependents.delete(urlInfo.url)
        if (dependency.dependents.size === 0) {
          removeDependencies(dependency, Array.from(dependency.dependencies))
          prunedUrlInfos.push(dependency)
        }
      })
    }
    removeDependencies(firstUrlInfo, urlsToRemove)
    if (prunedUrlInfos.length === 0) {
      return
    }
    prunedUrlInfos.forEach((prunedUrlInfo) => {
      prunedUrlInfo.modifiedTimestamp = Date.now()
      // should we delete?
      // delete urlInfos[prunedUrlInfo.url]
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
    const updateModifiedTimestamp = (urlInfo, modifiedTimestamp) => {
      const seen = []
      const iterate = (urlInfo) => {
        if (seen.includes(urlInfo.url)) {
          return
        }
        seen.push(urlInfo.url)
        urlInfo.modifiedTimestamp = modifiedTimestamp
        urlInfo.dependents.forEach((dependentUrl) => {
          const dependentUrlInfo = urlInfos[dependentUrl]
          const { hotAcceptDependencies = [] } = dependentUrlInfo.data
          if (!hotAcceptDependencies.includes(urlInfo.url)) {
            iterate(dependentUrlInfo)
          }
        })
      }
      iterate(urlInfo)
    }
    clientFileChangeCallbackList.push(({ url }) => {
      const urlInfo = urlInfos[url]
      if (urlInfo) {
        updateModifiedTimestamp(urlInfo, Date.now())
        urlInfo.contentEtag = null
      }
    })
  }

  return {
    urlInfos,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    inferReference,
    findDependent,
    updateReferences,

    toJSON: (rootDirectoryUrl) => {
      const data = {}
      Object.keys(urlInfos).forEach((url) => {
        const dependencyUrls = Array.from(urlInfos[url].dependencies)
        if (dependencyUrls.length) {
          const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl)
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
  return {
    modifiedTimestamp: 0,
    data: {}, // plugins can put whatever they want here
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    contentType: "", // "text/html", "text/css", "text/javascript", "application/json", ...
    url,
    filename: "",
    generatedUrl: null,
    isInline: false,
    inlineUrlSite: null,
    shouldIgnore: false,
    originalContent: undefined,
    content: undefined,
    contentEtag: null,
    sourcemap: null,
    sourcemapReference: null,
    timing: {},
    responseHeaders: {},
  }
}
