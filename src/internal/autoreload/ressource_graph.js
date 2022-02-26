import { createCallbackList } from "@jsenv/abort"

import { resolveUrl, urlToRelativeUrl, urlIsInsideOf } from "@jsenv/filesystem"

export const createRessourceGraph = ({ projectDirectoryUrl }) => {
  const hotUpdateCallbackList = createCallbackList()

  const ressources = {}
  const getRessourceByUrl = (url) => ressources[url]
  const reuseOrCreateRessource = (url) => {
    const existingRessource = getRessourceByUrl(url)
    if (existingRessource) return existingRessource
    const ressource = createRessource(url)
    ressources[url] = ressource
    return ressource
  }

  const applyImportmapResolution = (specifier, baseUrl) => {
    // const ressourceReferencingUrl = ressources[importerUrl]
    // if (ressourceReferencingUrl) {
    //   // TODO: find first html file importing this js file and use importmap
    //   eventually found in that html file
    // }
    const url = resolveUrl(specifier, baseUrl)
    return removeHmrQuery(url)
  }
  const applyUrlResolution = (specifier, baseUrl) => {
    const url = resolveUrl(specifier, baseUrl)
    return removeHmrQuery(url)
  }

  const getHmrTimestamp = (urlSpecifier, baseUrl) => {
    const url = applyImportmapResolution(urlSpecifier, baseUrl)
    if (!urlIsInsideOf(url, projectDirectoryUrl)) {
      return null
    }
    const ressource = ressources[url]
    if (!ressource) {
      return null
    }
    const { hmrTimestamp } = ressource
    if (!hmrTimestamp) {
      return null
    }
    return hmrTimestamp
  }

  const updateRessourceDependencies = ({
    url,
    type,
    dependencyUrls,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
  }) => {
    url = removeHmrQuery(url)
    const existingRessource = getRessourceByUrl(url)
    const ressource =
      existingRessource || (ressources[url] = createRessource(url))

    if (type !== undefined) {
      ressource.type = type
    }
    if (dependencyUrls !== undefined) {
      dependencyUrls.forEach((dependencyUrl) => {
        const dependency = reuseOrCreateRessource(dependencyUrl)
        ressource.dependencies.add(dependencyUrl)
        dependency.dependents.add(url)
      })
      if (existingRessource) {
        pruneDependencies(
          existingRessource,
          Array.from(existingRessource.dependencies).filter(
            (dep) => !dependencyUrls.includes(dep),
          ),
        )
      }
    }
    if (hotDecline !== undefined) {
      ressource.hotDecline = hotDecline
    }
    if (hotAcceptSelf !== undefined) {
      ressource.hotAcceptSelf = hotAcceptSelf
    }
    if (hotAcceptDependencies !== undefined) {
      ressource.hotAcceptDependencies = hotAcceptDependencies
    }
  }

  const onFileChange = ({ relativeUrl, event }) => {
    const url = resolveUrl(relativeUrl, projectDirectoryUrl)
    const ressource = getRessourceByUrl(url)
    // file not part of dependency graph
    if (!ressource) {
      return
    }
    updateHmrTimestamp(ressource, Date.now())
    const hotUpdate = propagateUpdate(ressource)
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

  const updateHmrTimestamp = (ressource, hmr) => {
    const seen = []
    const iterate = (url) => {
      if (seen.includes(url)) {
        return
      }
      seen.push(url)
      const ressource = ressources[url]
      ressource.hmrTimestamp = hmr
      ressource.dependents.forEach((dependentUrl) => {
        const dependent = ressources[dependentUrl]
        if (!dependent.hotAcceptDependencies.includes(url)) {
          iterate(dependentUrl, hmr)
        }
      })
    }
    iterate(ressource.url)
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

  const propagateUpdate = (firstRessource) => {
    const iterate = (ressource, trace) => {
      if (ressource.hotAcceptSelf) {
        return {
          accepted: true,
          reason:
            ressource === firstRessource
              ? `ressource accepts hot reload`
              : `a dependent ressource accepts hot reload`,
          instructions: [
            {
              type: ressource.type,
              boundary: urlToRelativeUrl(ressource.url, projectDirectoryUrl),
              acceptedBy: urlToRelativeUrl(ressource.url, projectDirectoryUrl),
            },
          ],
        }
      }
      const { dependents } = ressource
      const instructions = []
      for (const dependentUrl of dependents) {
        const dependent = ressources[dependentUrl]
        if (dependent.hotDecline) {
          return {
            declined: true,
            reason: `a dependent ressource declines hot reload`,
            declinedBy: dependentUrl,
          }
        }
        if (dependent.hotAcceptDependencies.includes(ressource.url)) {
          instructions.push({
            type: dependent.type,
            boundary: urlToRelativeUrl(dependentUrl, projectDirectoryUrl),
            acceptedBy: urlToRelativeUrl(ressource.url, projectDirectoryUrl),
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
          // declined explicitely by an other ressource, it must decline the whole update
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
          reason: `there is no ressource accepting hot reload while propagating update`,
        }
      }
      return {
        accepted: true,
        reason: `${instructions.length} dependent ressource(s) accepts hot reload`,
        instructions,
      }
    }
    const trace = []
    return iterate(firstRessource, trace)
  }

  const pruneDependencies = (firstRessource, urlsToRemove) => {
    const prunedRessources = []
    const removeDependencies = (ressource, urlsToPrune) => {
      urlsToPrune.forEach((urlToPrune) => {
        ressource.dependencies.delete(urlToPrune)
        const dependency = ressources[urlToPrune]
        if (!dependency) {
          return
        }
        dependency.dependents.delete(ressource.url)
        if (dependency.dependents.size === 0) {
          removeDependencies(dependency, Array.from(dependency.dependencies))
          prunedRessources.push(dependency)
        }
      })
    }
    removeDependencies(firstRessource, urlsToRemove)
    if (prunedRessources.length === 0) {
      return
    }
    prunedRessources.forEach((prunedRessource) => {
      prunedRessource.hmrTimestamp = Date.now()
      // delete ressources[prunedRessource.url]
    })
    const mainHotUpdate = propagateUpdate(firstRessource)
    const cause = `following files are no longer referenced: ${prunedRessources.map(
      (ressource) => urlToRelativeUrl(ressource.url, projectDirectoryUrl),
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
    while (i < prunedRessources.length) {
      const prunedRessource = prunedRessources[i++]
      if (prunedRessource.hotDecline) {
        notifyDeclined({
          cause,
          reason: `a pruned ressource declines hot reload`,
          declinedBy: urlToRelativeUrl(
            prunedRessource.url,
            projectDirectoryUrl,
          ),
        })
        return
      }
      instructions.push({
        type: "prune",
        boundary: urlToRelativeUrl(prunedRessource.url, projectDirectoryUrl),
        acceptedBy: urlToRelativeUrl(firstRessource.url, projectDirectoryUrl),
      })
    }
    notifyAccepted({
      cause,
      reason: mainHotUpdate.reason,
      instructions,
    })
  }

  return {
    hotUpdateCallbackList,
    applyImportmapResolution,
    applyUrlResolution,
    getRessourceByUrl,
    updateRessourceDependencies,
    onFileChange,
    getHmrTimestamp,

    toJSON: () => {
      const data = {}
      Object.keys(ressources).forEach((url) => {
        const dependencyUrls = Array.from(ressources[url].dependencies)
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

const removeHmrQuery = (url) => {
  const urlObject = new URL(url)
  urlObject.searchParams.delete("hmr")
  return String(urlObject)
}

const createRessource = (url) => {
  return {
    url,
    type: "",
    hmrTimestamp: 0,
    dependencies: new Set(),
    dependents: new Set(),
    hotAcceptSelf: false,
    hotAcceptDependencies: [],
    hotDecline: false,
  }
}
