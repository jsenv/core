import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForTarget = (target, { lineBreakNormalization }) => {
  return computeBuildRelativeUrl(target.targetUrl, target.targetBuildBuffer, {
    pattern: targetToFileNamePattern(target),
    contentType: target.targetContentType,
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
    if (target.targetIsEntry || target.targetIsJsModule) {
      return `[name][extname]`
    }
    return assetFileNamePatternWithoutHash
  }

  if (target.targetIsEntry || target.targetIsJsModule) {
    return `[name]-[hash][extname]`
  }
  return assetFileNamePattern
}
