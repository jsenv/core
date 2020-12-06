export const parseWebmanifest = (manifestTarget, { notifyReferenceFound }, { minify }) => {
  // const manifestUrl = manifestTarget.url
  const manifestString = String(manifestTarget.content.value)

  const manifest = JSON.parse(manifestString)
  const { icons = [] } = manifest

  const iconReferences = icons.map((icon) => {
    const iconReference = notifyReferenceFound({
      specifier: icon.src,
    })
    return iconReference
  })

  return ({ getReferenceUrlRelativeToImporter }) => {
    if (icons.length === 0) {
      if (minify) {
        // this is to remove eventual whitespaces
        return JSON.stringify(manifest)
      }
      return JSON.stringify(manifestString)
    }

    const iconsAfterBuild = icons.map((icon, index) => {
      const iconAfterBuild = { ...icon }
      iconAfterBuild.src = getReferenceUrlRelativeToImporter(iconReferences[index])
      return iconAfterBuild
    })
    const manifestAfterBuild = { ...manifest }
    manifestAfterBuild.icons = iconsAfterBuild
    if (minify) {
      return JSON.stringify(manifestAfterBuild)
    }
    return JSON.stringify(manifestAfterBuild, null, "  ")
  }
}
