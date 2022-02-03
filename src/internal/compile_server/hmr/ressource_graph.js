export const createRessourceGraph = () => {
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
    dependencyUrls,
    hotAcceptSelf,
    hotAcceptDependencies,
  }) => {
    const existingRessource = getRessourceByUrl(url)
    const ressource = existingRessource || createRessource(url)
    const notUsedAnymore = []
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
    if (hotAcceptSelf !== undefined) {
      ressource.hotAcceptSelf = hotAcceptSelf
    }
    if (hotAcceptDependencies !== undefined) {
      ressource.hotAcceptDependencies = hotAcceptDependencies
    }
    return notUsedAnymore
  }

  return {
    getRessourceByUrl,
    updateRessourceDependencies,
  }
}

const createRessource = (url) => {
  return {
    url,
    dependencies: new Set(),
    dependents: new Set(),
    hotAcceptSelf: false,
    hotAcceptDependencies: [],
  }
}
