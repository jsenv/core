import { urlToRelativeUrl } from "@jsenv/filesystem"

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

  const updateRessourceDependencies = ({
    url,
    type,
    dependencyUrls,
    importMetaHotDecline,
    importMetaHotAcceptSelf,
    importMetaHotAcceptDependencies,
  }) => {
    const existingRessource = getRessourceByUrl(url)
    const ressource = existingRessource || createRessource(url)
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
    if (importMetaHotDecline !== undefined) {
      ressource.importMetaHotDecline = importMetaHotDecline
    }
    if (importMetaHotAcceptSelf !== undefined) {
      ressource.importMetaHotAcceptSelf = importMetaHotAcceptSelf
    }
    if (importMetaHotAcceptDependencies !== undefined) {
      ressource.importMetaHotAcceptDependencies =
        importMetaHotAcceptDependencies
    }
    return notUsedAnymore
  }

  const getReloadInstructions = (urlModified) => {
    const ressource = getRessourceByUrl(urlModified)
    if (!ressource) {
      return null
    }
    const updatePropagationResult = propagateUpdate(urlModified)
    if (updatePropagationResult.declined) {
      return {
        type: "full_reload",
        reason: updatePropagationResult.reason,
        declinedBy: urlToRelativeUrl(
          updatePropagationResult.declinedBy,
          projectDirectoryUrl,
        ),
      }
    }
    return {
      type: "hot_reload",
      updates: updatePropagationResult.boundaries.map(
        ({ boundary, acceptedBy }) => {
          return {
            type: ressources[boundary].type,
            url: urlToRelativeUrl(boundary, projectDirectoryUrl),
            acceptedBy: urlToRelativeUrl(acceptedBy, projectDirectoryUrl),
          }
        },
      ),
    }
  }

  const propagateUpdate = (url, trace = []) => {
    const ressource = ressources[url]
    if (ressource.importMetaHotAcceptSelf) {
      return {
        accepted: true,
        boundaries: [
          {
            boundary: url,
            acceptedBy: url,
          },
        ],
      }
    }
    const { importers } = ressource
    if (!importers.size) {
      return {
        accepted: true,
        boundaries: [],
      }
    }
    const boundaries = []
    for (const importerUrl of ressource.importers) {
      const importer = ressources[importerUrl]
      if (importer.importMetaHotDecline) {
        return {
          declined: true,
          reason: "found import.meta.hot.decline() while propagating update",
          declinedBy: importerUrl,
        }
      }
      if (importer.importMetaHotAcceptDependencies.includes(url)) {
        boundaries.push({
          boundary: importerUrl,
          acceptedBy: url,
        })
        continue
      }
      if (trace.includes(importerUrl)) {
        return {
          declined: true,
          reason: "circular dependency",
        }
      }
      const importerPropagationResult = propagateUpdate(importerUrl, [
        ...trace,
        importerUrl,
      ])
      if (importerPropagationResult.declined) {
        return importerPropagationResult
      }
      boundaries.push(...importerPropagationResult.boundaries)
    }
    return {
      accepted: true,
      boundaries,
    }
  }

  return {
    getRessourceByUrl,
    updateRessourceDependencies,
    getReloadInstructions,
  }
}

const createRessource = (url) => {
  return {
    url,
    type: "",
    dependencies: new Set(),
    dependents: new Set(),
    hotAcceptSelf: false,
    hotAcceptDependencies: [],
  }
}
