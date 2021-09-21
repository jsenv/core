import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForTarget = (
  target,
  { lineBreakNormalization },
) => {
  return computeBuildRelativeUrl(target.targetUrl, target.bufferAfterBuild, {
    pattern: targetToFileNamePattern(target),
    contentType: target.ressourceContentType,
    lineBreakNormalization,
  })
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"
const assetFileNamePatternWithoutHash = "assets/[name][extname]"

const targetToFileNamePattern = (target) => {
  if (target.targetFileNamePattern) {
    return target.targetFileNamePattern
  }

  if (target.targetUrlVersioningDisabled) {
    if (target.isEntryPoint || target.isJsModule) {
      return `[name][extname]`
    }
    return assetFileNamePatternWithoutHash
  }

  if (target.isEntryPoint || target.isJsModule) {
    return `[name]-[hash][extname]`
  }
  return assetFileNamePattern
}
