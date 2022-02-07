export const scanJs = ({ ressourceGraph, url, metadata }) => {
  const dependencyUrls = metadata.urlMentions.map(({ type, specifier }) => {
    if (type === "url") {
      return ressourceGraph.applyUrlResolution(specifier, url)
    }
    return ressourceGraph.applyImportmapResolution(specifier, url)
  })
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
