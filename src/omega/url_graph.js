import { createCallbackList } from "@jsenv/abort"
import { urlToRelativeUrl } from "@jsenv/filesystem"

export const createUrlGraph = () => {
  const urlInfos = {}
  const getUrlInfo = (url) => urlInfos[url]
  const deleteUrlInfo = (url) => delete urlInfos[url]
  const reuseOrCreateUrlInfo = (url) => {
    const existingUrlInfo = urlInfos[url]
    if (existingUrlInfo) return existingUrlInfo
    const urlInfo = createUrlInfo(url)
    urlInfos[url] = urlInfo
    return urlInfo
  }
  const inferReference = (url, parentUrl) => {
    const parentUrlInfo = urlInfos[parentUrl]
    if (!parentUrlInfo) {
      return null
    }
    const firstReferenceOnThatUrl = parentUrlInfo.references.find(
      (reference) => reference.url === url,
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

  const prunedCallbackList = createCallbackList()
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
    prunedCallbackList.notify({ prunedUrlInfos, firstUrlInfo })
  }

  return {
    urlInfos,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    inferReference,
    findDependent,

    prunedCallbackList,
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
    data: {}, // plugins can put whatever they want here
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    contentType: "application/octet-stream", // "text/html", "text/css", "text/javascript", "application/json", ...
    url,
    filename: "",
    generatedUrl: null,
    isInline: false,
    inlineUrlSite: null,
    external: false,
    originalContent: undefined,
    content: undefined,
    sourcemap: null,
    sourcemapReference: null,
  }
}
