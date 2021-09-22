import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForRessource = (
  ressource,
  { lineBreakNormalization },
) => {
  return computeBuildRelativeUrl(
    ressource.url,
    ressource.bufferAfterBuild,
    {
      pattern: fileNamePatternFromRessource(ressource),
      contentType: ressource.contentType,
      lineBreakNormalization,
    },
  )
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"
const assetFileNamePatternWithoutHash = "assets/[name][extname]"

const fileNamePatternFromRessource = (ressource) => {
  if (ressource.fileNamePattern) {
    return ressource.fileNamePattern
  }

  if (ressource.urlVersioningDisabled) {
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
