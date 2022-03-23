import { createCallbackList } from "@jsenv/abort"
import { urlToRelativeUrl } from "@jsenv/filesystem"

export const createUrlGraph = () => {
  const urlInfos = {}
  const getUrlInfo = (url) => urlInfos[url]
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
      if (!dependencyUrls.includes(reference.url)) {
        dependencyUrls.push(reference.url)
      }
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
    url,
    generatedUrl: null,
    inlineUrlSite: null,
    contentType: "",
    originalContent: "",
    content: "",
    sourcemap: null,
    type: "",
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
  }
}
