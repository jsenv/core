import { resolveUrl, urlToRelativeUrl, urlIsInsideOf } from "@jsenv/filesystem"

export const createRessourceGraph = ({ projectDirectoryUrl }) => {
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

  const injectHmrIntoSpecifier = (specifier, baseUrl) => {
    const url = applyImportmapResolution(specifier, baseUrl)
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
    const notUsedAnymore = []
    if (type !== undefined) {
      ressource.type = type
    }
    if (dependencyUrls !== undefined) {
      if (existingRessource) {
        const oldDependencyUrls = Array.from(
          existingRessource.dependencies,
        ).filter((depUrl) => !dependencyUrls.includes(depUrl))
        oldDependencyUrls.forEach((oldDependencyUrl) => {
          const oldDependency = ressources[oldDependencyUrl]
          if (oldDependency) {
            oldDependency.dependents.delete(url)
            if (oldDependency.dependents.size === 0) {
              notUsedAnymore.push(oldDependencyUrl)
            }
          }
        })
      }
      dependencyUrls.forEach((dependencyUrl) => {
        const dependency = reuseOrCreateRessource(dependencyUrl)
        ressource.dependencies.add(url)
        dependency.dependents.add(url)
      })
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
    return notUsedAnymore
  }

  const onFileChange = (url) => {
    const ressource = getRessourceByUrl(url)
    if (!ressource) {
      return null
    }
    updateHmrTimestamp(ressource, Date.now())
    const updatePropagationResult = propagateUpdate(ressource)
    if (updatePropagationResult.declined) {
      return {
        type: "full_reload",
        reason: updatePropagationResult.reason,
        declinedBy: updatePropagationResult.declinedBy
          ? urlToRelativeUrl(
              updatePropagationResult.declinedBy,
              projectDirectoryUrl,
            )
          : undefined,
      }
    }
    return {
      type: "hot_reload",
      timestamp: Date.now(),
      updates: updatePropagationResult.boundaries.map(
        ({ boundary, acceptedBy }) => {
          return {
            type: ressources[boundary].type,
            relativeUrl: urlToRelativeUrl(boundary, projectDirectoryUrl),
            acceptedByRelativeUrl: urlToRelativeUrl(
              acceptedBy,
              projectDirectoryUrl,
            ),
          }
        },
      ),
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

  const propagateUpdate = (ressource) => {
    const iterate = (ressource, trace) => {
      if (ressource.hotAcceptSelf) {
        return {
          accepted: true,
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
            reason: `found ressource declining hot reload while propagating update`,
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
        if (dependentPropagationResult.declined) {
          return dependentPropagationResult
        }
        boundaries.push(...dependentPropagationResult.boundaries)
      }
      if (boundaries.length === 0) {
        return {
          declined: true,
          reason: `there is no ressource accepting hot reload while propagating update`,
        }
      }
      return {
        accepted: true,
        boundaries,
      }
    }
    const trace = []
    return iterate(ressource, trace)
  }

  return {
    applyImportmapResolution,
    applyUrlResolution,
    getRessourceByUrl,
    updateRessourceDependencies,
    onFileChange,
    injectHmrIntoSpecifier,
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
