import { createCallbackList } from "@jsenv/abort"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

export const createProjectGraph = ({ projectDirectoryUrl }) => {
  const hotUpdateCallbackList = createCallbackList()
  const prunedCallbackList = createCallbackList()

  const urlInfos = {}
  const getUrlInfo = (url) => urlInfos[url]
  const reuseOrCreateUrlInfo = (url) => {
    const existingUrlInfo = urlInfos[url]
    if (existingUrlInfo) return existingUrlInfo
    const urlInfo = createUrlInfo(url)
    urlInfos[url] = urlInfo
    return urlInfo
  }

  const inferUrlSite = (url, parentUrl) => {
    const parentUrlInfo = urlInfos[parentUrl]
    if (!parentUrlInfo) {
      return null
    }
    const dependencyUrlSite = parentUrlInfo.dependencyUrlSites[url]
    if (!dependencyUrlSite) {
      return null
    }
    return {
      url: dependencyUrlSite.url,
      content:
        dependencyUrlSite.url === parentUrlInfo.url
          ? parentUrlInfo.originalContent
          : parentUrlInfo.content,
      line: dependencyUrlSite.line,
      column: dependencyUrlSite.column,
    }
  }

  const updateUrlInfo = ({
    url,
    generatedUrl,
    type,
    contentType,
    originalContent,
    content,
    sourcemap,
    version,
    parentUrlSite,
    dependencyUrlSites,
    dependencyUrls,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
  }) => {
    const existingUrlInfo = urlInfos[url]
    const urlInfo = existingUrlInfo || (urlInfos[url] = createUrlInfo(url))
    urlInfo.generatedUrl = generatedUrl
    urlInfo.parentUrlSite = parentUrlSite
    urlInfo.type = type
    urlInfo.contentType = contentType
    urlInfo.originalContent = originalContent
    urlInfo.content = content
    urlInfo.version = version
    urlInfo.sourcemap = sourcemap
    urlInfo.dependencyUrlSites = dependencyUrlSites
    dependencyUrls.forEach((dependencyUrl) => {
      const dependencyUrlInfo = reuseOrCreateUrlInfo(dependencyUrl)
      urlInfo.dependencies.add(dependencyUrl)
      dependencyUrlInfo.dependents.add(url)
    })
    if (existingUrlInfo) {
      pruneDependencies(
        existingUrlInfo,
        Array.from(existingUrlInfo.dependencies).filter(
          (dep) => !dependencyUrls.includes(dep),
        ),
      )
    }
    urlInfo.hotDecline = hotDecline
    urlInfo.hotAcceptSelf = hotAcceptSelf
    urlInfo.hotAcceptDependencies = hotAcceptDependencies
    return urlInfo
  }

  const onFileChange = ({ relativeUrl, event }) => {
    const url = resolveUrl(relativeUrl, projectDirectoryUrl)
    const urlInfo = urlInfos[url]
    // file not part of dependency graph
    if (!urlInfo) {
      return
    }
    updateHmrTimestamp(urlInfo, Date.now())
    const hotUpdate = propagateUpdate(urlInfo)
    if (hotUpdate.declined) {
      notifyDeclined({
        cause: `${relativeUrl} ${event}`,
        reason: hotUpdate.reason,
        declinedBy: hotUpdate.declinedBy,
      })
    } else {
      notifyAccepted({
        cause: `${relativeUrl} ${event}`,
        reason: hotUpdate.reason,
        instructions: hotUpdate.instructions,
      })
    }
  }

  const updateHmrTimestamp = (urlInfo, hmrTimestamp) => {
    const seen = []
    const iterate = (url) => {
      if (seen.includes(url)) {
        return
      }
      seen.push(url)
      const urlInfo = urlInfo[url]
      urlInfo.hmrTimestamp = hmrTimestamp
      urlInfo.dependents.forEach((dependentUrl) => {
        const dependent = urlInfo[dependentUrl]
        if (!dependent.hotAcceptDependencies.includes(url)) {
          iterate(dependentUrl, hmrTimestamp)
        }
      })
    }
    iterate(urlInfo.url)
  }

  const notifyDeclined = ({ cause, reason, declinedBy }) => {
    hotUpdateCallbackList.notify({
      declined: true,
      cause,
      reason,
      declinedBy,
    })
  }
  const notifyAccepted = ({ cause, reason, instructions }) => {
    hotUpdateCallbackList.notify({
      accepted: true,
      cause,
      reason,
      instructions,
    })
  }

  const propagateUpdate = (firstUrlInfo) => {
    const iterate = (urlInfo, trace) => {
      if (urlInfo.hotAcceptSelf) {
        return {
          accepted: true,
          reason:
            urlInfo === firstUrlInfo
              ? `file accepts hot reload`
              : `a dependent file accepts hot reload`,
          instructions: [
            {
              type: urlInfo.type,
              boundary: urlToRelativeUrl(urlInfo.url, projectDirectoryUrl),
              acceptedBy: urlToRelativeUrl(urlInfo.url, projectDirectoryUrl),
            },
          ],
        }
      }
      const { dependents } = urlInfo
      const instructions = []
      for (const dependentUrl of dependents) {
        const dependent = urlInfos[dependentUrl]
        if (dependent.hotDecline) {
          return {
            declined: true,
            reason: `a dependent file declines hot reload`,
            declinedBy: dependentUrl,
          }
        }
        if (dependent.hotAcceptDependencies.includes(urlInfo.url)) {
          instructions.push({
            type: dependent.type,
            boundary: urlToRelativeUrl(dependentUrl, projectDirectoryUrl),
            acceptedBy: urlToRelativeUrl(urlInfo.url, projectDirectoryUrl),
          })
          continue
        }
        if (trace.includes(dependentUrl)) {
          return {
            declined: true,
            reason: "circular dependency",
            declinedBy: urlToRelativeUrl(dependentUrl, projectDirectoryUrl),
          }
        }
        const dependentPropagationResult = iterate(dependent, [
          ...trace,
          dependentUrl,
        ])
        if (dependentPropagationResult.accepted) {
          instructions.push(...dependentPropagationResult.instructions)
          continue
        }
        if (
          // declined explicitely by an other file, it must decline the whole update
          dependentPropagationResult.declinedBy
        ) {
          return dependentPropagationResult
        }
        // declined by absence of boundary, we can keep searching
        continue
      }
      if (instructions.length === 0) {
        return {
          declined: true,
          reason: `there is no file accepting hot reload while propagating update`,
        }
      }
      return {
        accepted: true,
        reason: `${instructions.length} dependent file(s) accepts hot reload`,
        instructions,
      }
    }
    const trace = []
    return iterate(firstUrlInfo, trace)
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
      prunedUrlInfo.hmrTimestamp = Date.now()
      // delete urlInfos[prunedRessource.url]
      prunedCallbackList.notify(prunedUrlInfo)
    })
    const mainHotUpdate = propagateUpdate(firstUrlInfo)
    const cause = `following files are no longer referenced: ${prunedUrlInfos.map(
      (prunedUrlInfo) =>
        urlToRelativeUrl(prunedUrlInfo.url, projectDirectoryUrl),
    )}`
    // now check if we can hot update the main ressource
    // then if we can hot update all dependencies
    if (mainHotUpdate.declined) {
      notifyDeclined({
        cause,
        reason: mainHotUpdate.reason,
        declinedBy: mainHotUpdate.declinedBy,
      })
      return
    }
    // main can hot update
    let i = 0
    const instructions = []
    while (i < prunedUrlInfos.length) {
      const prunedUrlInfo = prunedUrlInfos[i++]
      if (prunedUrlInfo.hotDecline) {
        notifyDeclined({
          cause,
          reason: `a pruned file declines hot reload`,
          declinedBy: urlToRelativeUrl(prunedUrlInfo.url, projectDirectoryUrl),
        })
        return
      }
      instructions.push({
        type: "prune",
        boundary: urlToRelativeUrl(prunedUrlInfo.url, projectDirectoryUrl),
        acceptedBy: urlToRelativeUrl(firstUrlInfo.url, projectDirectoryUrl),
      })
    }
    notifyAccepted({
      cause,
      reason: mainHotUpdate.reason,
      instructions,
    })
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

  return {
    hotUpdateCallbackList,
    prunedCallbackList,

    urlInfos,
    getUrlInfo,
    updateUrlInfo,
    onFileChange,

    inferUrlSite,
    findDependent,

    toJSON: () => {
      const data = {}
      Object.keys(urlInfos).forEach((url) => {
        const dependencyUrls = Array.from(urlInfos[url].dependencies)
        if (dependencyUrls.length) {
          const relativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)
          data[relativeUrl] = dependencyUrls.map((dependencyUrl) =>
            urlToRelativeUrl(dependencyUrl, projectDirectoryUrl),
          )
        }
      })
      return data
    },
  }
}

const createUrlInfo = (url) => {
  return {
    url,
    generatedUrl: null,
    type: "",
    contentType: "",
    originalContent: "",
    content: "",
    sourcemap: null,
    version: null,
    hmrTimestamp: 0,
    parentUrlSite: null,
    dependencyUrlSites: {},
    dependencies: new Set(),
    dependents: new Set(),
    hotDecline: false,
    hotAcceptSelf: false,
    hotAcceptDependencies: [],
  }
}
