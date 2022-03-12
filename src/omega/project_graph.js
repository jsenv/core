import { createCallbackList } from "@jsenv/abort"
import { resolveUrl, urlToRelativeUrl, urlIsInsideOf } from "@jsenv/filesystem"

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

  const getUrlTrace = (dependencyUrl, url) => {
    const urlInfo = urlInfos[url]
    if (!urlInfo) {
      return null
    }
    const dependencyUrlTrace = urlInfo.dependencyUrlTraces[dependencyUrl]
    if (!dependencyUrlTrace) {
      return null
    }
    return dependencyUrlTrace
  }

  const getHmrTimestamp = (url) => {
    if (!urlIsInsideOf(url, projectDirectoryUrl)) {
      return null
    }
    const urlInfo = urlInfos[url]
    if (!urlInfo) {
      return null
    }
    const { hmrTimestamp } = urlInfo
    if (!hmrTimestamp) {
      return null
    }
    return hmrTimestamp
  }

  const updateUrlInfo = ({
    url,
    type,
    contentType,
    content,
    sourcemap,
    dependencyUrls,
    dependencyUrlTraces,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
  }) => {
    const existingUrlInfo = urlInfos[url]
    const urlInfo = existingUrlInfo || (urlInfos[url] = createUrlInfo(url))

    if (type !== undefined) {
      urlInfo.type = type
    }
    if (contentType !== undefined) {
      urlInfo.contentType = contentType
    }
    if (content !== undefined) {
      urlInfo.content = content
    }
    if (sourcemap !== undefined) {
      urlInfo.sourcemap = sourcemap
    }
    if (dependencyUrls !== undefined) {
      urlInfo.dependencyUrlTraces = dependencyUrlTraces
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
    }
    if (hotDecline !== undefined) {
      urlInfo.hotDecline = hotDecline
    }
    if (hotAcceptSelf !== undefined) {
      urlInfo.hotAcceptSelf = hotAcceptSelf
    }
    if (hotAcceptDependencies !== undefined) {
      urlInfo.hotAcceptDependencies = hotAcceptDependencies
    }
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
    getHmrTimestamp,

    getUrlTrace,
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
    type: "",
    hmrTimestamp: 0,
    dependencies: new Set(),
    dependencyUrlTraces: {},
    dependents: new Set(),
    hotAcceptSelf: false,
    hotAcceptDependencies: [],
    hotDecline: false,
  }
}
