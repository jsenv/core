export const updateCssHotMetas = ({ ressourceGraph, url, urlMentions }) => {
  const dependencyUrls = []
  const hotAcceptDependencies = []
  urlMentions.forEach(({ specifier }) => {
    const ressourceUrl = ressourceGraph.applyUrlResolution(specifier, url)
    dependencyUrls.push(ressourceUrl)
    // we don't know how to reload css, it can be anywhere
    // in order to reload it, an importer should self accept hot reloading
    // or if we talk about html, be in importAcceptDependencies
    // hotAcceptDependencies.push(ressourceUrl)
  })
  ressourceGraph.updateRessourceDependencies({
    url,
    type: "css",
    dependencyUrls,
    hotAcceptSelf: false,
    hotAcceptDependencies,
  })
  return dependencyUrls
}
