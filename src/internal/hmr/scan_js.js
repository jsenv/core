export const scanJs = ({ ressourceGraph, url, metadata }) => {
  const dependencyUrls = metadata.urlDependencies.map(
    ({ type, urlSpecifier }) => {
      if (type === "url") {
        return ressourceGraph.applyUrlResolution(urlSpecifier, url)
      }
      return ressourceGraph.applyImportmapResolution(urlSpecifier, url)
    },
  )
  ressourceGraph.updateRessourceDependencies({
    url,
    type: "js",
    dependencyUrls,
    hotDecline: metadata.importMetaHotDecline,
    hotAcceptSelf: metadata.importMetaHotAcceptSelf,
    hotAcceptDependencies: metadata.importMetaHotAcceptDependencies.map(
      (acceptDependencyUrlSpecifier) =>
        ressourceGraph.applyImportmapResolution(
          acceptDependencyUrlSpecifier,
          url,
        ),
    ),
  })
  return dependencyUrls
}
