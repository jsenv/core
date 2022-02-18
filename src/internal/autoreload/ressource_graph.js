import { createCallbackList } from "@jsenv/abort"

import { resolveUrl, urlToRelativeUrl, urlIsInsideOf } from "@jsenv/filesystem"

export const createRessourceGraph = ({ projectDirectoryUrl }) => {
  const pruneCallbackList = createCallbackList()

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

  const injectHmrIntoUrlSpecifier = (urlSpecifier, baseUrl) => {
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
    const urlWithHmr = injectHmrQuery(url, hmrTimestamp)
    const relativeUrl = urlToRelativeUrl(urlWithHmr, baseUrl)
    if (relativeUrl.startsWith(".")) {
      return relativeUrl
    }
    // ensure "./" for relative specifiers otherwise we could get
    // bare specifier errors for js
    return `./${relativeUrl}`
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
        const notUsedAnymore = []
        const pruneDependencies = (ressource, urlsToPrune) => {
          urlsToPrune.forEach((urlToPrune) => {
            ressource.dependencies.delete(urlToPrune)
            const dependency = ressources[urlToPrune]
            if (dependency) {
              dependency.dependents.delete(ressource.url)
              if (dependency.dependents.size === 0) {
                notUsedAnymore.push(ressource.url)
                // should we delete ressources[url]? not sure
                pruneDependencies(
                  dependency,
                  Array.from(dependency.dependencies),
                )
              }
            }
          })
        }
        pruneDependencies(
          existingRessource,
          Array.from(existingRessource.dependencies).filter(
            (dep) => !dependencyUrls.includes(dep),
          ),
        )
        if (notUsedAnymore.length) {
          onPrunedFiles(notUsedAnymore)
        }
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

  const onPrunedFiles = (urls) => {
    urls.forEach((url) => {
      ressources[url].hmrTimestamp = Date.now()
    })
    pruneCallbackList.notify(urls)
  }

  const onFileChange = (url) => {
    const ressource = getRessourceByUrl(url)
    if (!ressource) {
      return null
    }
    updateHmrTimestamp(ressource, Date.now())
    const updatePropagationResult = propagateUpdate(ressource)
    return updatePropagationResult
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

  const propagateUpdate = (firstRessource) => {
    const iterate = (ressource, trace) => {
      if (ressource.hotAcceptSelf) {
        return {
          accepted: true,
          reason:
            ressource === firstRessource
              ? `ressource accepts hot reload`
              : `a dependent ressource accepts hot reload`,
          boundaries: [
            {
              boundary: ressource.url,
              acceptedBy: ressource.url,
            },
          ],
        }
      }
      const { dependents } = ressource
      const boundaries = []
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
          boundaries.push({
            boundary: dependentUrl,
            acceptedBy: ressource.url,
          })
          continue
        }
        if (trace.includes(dependentUrl)) {
          return {
            declined: true,
            reason: "circular dependency",
            declinedBy: dependentUrl,
          }
        }
        const dependentPropagationResult = iterate(dependent, [
          ...trace,
          dependentUrl,
        ])
        if (dependentPropagationResult.accepted) {
          boundaries.push(...dependentPropagationResult.boundaries)
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
      if (boundaries.length === 0) {
        return {
          declined: true,
          reason: `there is no ressource accepting hot reload while propagating update`,
        }
      }
      return {
        accepted: true,
        reason: `${boundaries.length} dependent ressource(s) accepts hot reload`,
        boundaries,
      }
    }
    const trace = []
    return iterate(firstRessource, trace)
  }

  return {
    pruneCallbackList,
    applyImportmapResolution,
    applyUrlResolution,
    getRessourceByUrl,
    updateRessourceDependencies,
    onFileChange,
    injectHmrIntoUrlSpecifier,

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

const injectHmrQuery = (url, hmr) => {
  const urlObject = new URL(url)
  urlObject.searchParams.set("hmr", hmr)
  return String(urlObject)
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
