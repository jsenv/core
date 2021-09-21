import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForRessource = (
  ressource,
  { lineBreakNormalization },
) => {
  return computeBuildRelativeUrl(
    ressource.ressourceUrl,
    ressource.bufferAfterBuild,
    {
      pattern: fileNamePatternFromRessource(ressource),
      contentType: ressource.ressourceContentType,
      lineBreakNormalization,
    },
  )
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"
const assetFileNamePatternWithoutHash = "assets/[name][extname]"

const fileNamePatternFromRessource = (ressource) => {
  if (ressource.ressourceFileNamePattern) {
    return ressource.ressourceFileNamePattern
  }

  if (ressource.ressourceUrlVersioningDisabled) {
    if (ressource.isEntryPoint || ressource.isJsModule) {
      return `[name][extname]`
    }
    return assetFileNamePatternWithoutHash
  }

  if (ressource.isEntryPoint || ressource.isJsModule) {
    return `[name]-[hash][extname]`
  }
  return assetFileNamePattern
}
