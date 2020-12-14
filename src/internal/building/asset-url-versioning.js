import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForTarget = (target) => {
  return computeBuildRelativeUrl(
    target.targetUrl,
    target.targetBufferAfterTransformation,
    targetToFileNamePattern(target),
  )
}

const assetFileNamePattern = "assets/[name]-[hash][extname]"
const assetFileNamePatternWithoutHash = "assets/[name][extname]"

const targetToFileNamePattern = (target) => {
  if (target.targetFileNamePattern) {
    return target.targetFileNamePattern
  }

  if (target.targetUrlVersioningDisabled) {
    if (target.targetIsEntry) {
      return `[name][extname]`
    }
    return assetFileNamePatternWithoutHash
  }

  if (target.targetIsEntry) {
    return `[name]-[hash][extname]`
  }
  return assetFileNamePattern
}

export const precomputeBuildRelativeUrlForTarget = (target, sourceAfterTransformation = "") => {
  if (target.targetBuildRelativeUrl) {
    return target.targetBuildRelativeUrl
  }

  target.targetBufferAfterTransformation = sourceAfterTransformation
  const precomputedBuildRelativeUrl = computeBuildRelativeUrlForTarget(target)
  target.targetBufferAfterTransformation = undefined
  return precomputedBuildRelativeUrl
}
