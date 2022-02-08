export const updateJsHotMeta = ({
  ressourceGraph,
  url,
  urlMentions,
  importMetaHotDecline,
  importMetaHotAcceptSelf,
  importMetaHotAcceptDependencies,
}) => {
  const dependencyUrls = urlMentions.map(({ type, specifier }) => {
    if (type === "url") {
      return ressourceGraph.applyUrlResolution(specifier, url)
    }
    return ressourceGraph.applyImportmapResolution(specifier, url)
  })
  ressourceGraph.updateRessourceDependencies({
    url,
    type: "js_module",
    dependencyUrls,
    hotDecline: importMetaHotDecline,
    hotAcceptSelf: importMetaHotAcceptSelf,
    hotAcceptDependencies: importMetaHotAcceptDependencies.map(
      (acceptDependencyUrlSpecifier) =>
        ressourceGraph.applyImportmapResolution(
          acceptDependencyUrlSpecifier,
          url,
        ),
    ),
  })
  return dependencyUrls
}
