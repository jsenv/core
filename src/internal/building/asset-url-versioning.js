import { computeBuildRelativeUrl } from "./url-versioning.js"

export const computeBuildRelativeUrlForTarget = (target) => {
  return computeBuildRelativeUrl(
    target.targetUrl,
    target.targetBuildBuffer,
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
    if (target.targetIsEntry || target.targetIsJsModule) {
      return `[name][extname]`
    }
    return assetFileNamePatternWithoutHash
  }

  if (target.targetIsEntry || target.isTargetIsJsModule) {
    return `[name]-[hash][extname]`
  }
  return assetFileNamePattern
}

export const precomputeBuildRelativeUrlForTarget = (target, targetBuildBuffer = "") => {
  if (target.targetBuildRelativeUrl) {
    return target.targetBuildRelativeUrl
  }

  target.targetBuildBuffer = targetBuildBuffer
  const precomputedBuildRelativeUrl = computeBuildRelativeUrlForTarget(target)
  target.targetBuildBuffer = undefined
  return precomputedBuildRelativeUrl
}
