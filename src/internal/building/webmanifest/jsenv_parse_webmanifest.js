export const parseWebmanifestRessource = (
  webmanifestRessource,
  { notifyReferenceFound },
  { minify },
) => {
  // const manifestUrl = manifestTarget.url
  const manifestString = String(webmanifestRessource.bufferBeforeBuild)

  const manifest = JSON.parse(manifestString)
  const { icons = [] } = manifest

  const iconReferences = icons.map((icon, index) => {
    const iconReference = notifyReferenceFound({
      referenceLabel: `web manifest icon ${index}`,
      ressourceSpecifier: icon.src,
    })
    return iconReference
  })

  return ({ getUrlRelativeToImporter }) => {
    if (icons.length === 0) {
      if (minify) {
        // this is to remove eventual whitespaces
        webmanifestRessource.buildEnd(JSON.stringify(manifest))
        return
      }
      webmanifestRessource.buildEnd(JSON.stringify(manifest, null, "  "))
      return
    }

    const iconsAfterBuild = icons.map((icon, index) => {
      const iconAfterBuild = { ...icon }
      iconAfterBuild.src = getUrlRelativeToImporter(
        iconReferences[index].ressource,
      )
      return iconAfterBuild
    })
    const manifestAfterBuild = { ...manifest }
    manifestAfterBuild.icons = iconsAfterBuild
    if (minify) {
      webmanifestRessource.buildEnd(JSON.stringify(manifestAfterBuild))
      return
    }
    webmanifestRessource.buildEnd(
      JSON.stringify(manifestAfterBuild, null, "  "),
    )
  }
}
