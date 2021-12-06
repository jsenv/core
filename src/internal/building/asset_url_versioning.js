import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForRessource = (
  ressource,
  { lineBreakNormalization },
) => {
  return computeBuildRelativeUrl(ressource.url, ressource.bufferAfterBuild, {
    pattern: fileNamePatternFromRessource(ressource),
    contentType: ressource.contentType,
    lineBreakNormalization,
  })
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"
const assetFileNamePatternWithoutHash = "assets/[name][extname]"

const fileNamePatternFromRessource = (ressource) => {
  if (ressource.fileNamePattern) {
    return ressource.fileNamePattern
  }

  if (ressource.urlVersioningDisabled) {
    if (canMoveToAssetsDirectory(ressource)) {
      return assetFileNamePatternWithoutHash
    }
    return `[name][extname]`
  }

  if (canMoveToAssetsDirectory(ressource)) {
    return assetFileNamePattern
  }
  return `[name]-[hash][extname]`
}

const canMoveToAssetsDirectory = (ressource) => {
  if (ressource.isEntryPoint) {
    return false
  }
  // in theory js module can be moved to assets directory
  // but that needs to be tested
  if (ressource.isJsModule) {
    return false
  }
  // service worker MUST be at the root (same level than the HTML file)
  // otherwise it might be registered for the scope "/assets/" instead of "/"
  if (ressource.isServiceWorker) {
    return false
  }
  return true
}
