import { valueToVersion } from "./valueToVersion.js"

export const versionCompare = (versionA, versionB) => {
  const semanticVersionA = valueToVersion(versionA)
  const semanticVersionB = valueToVersion(versionB)

  const majorDiff = semanticVersionA.major - semanticVersionB.major
  if (majorDiff > 0) {
    return majorDiff
  }
  if (majorDiff < 0) {
    return majorDiff
  }

  const minorDiff = semanticVersionA.minor - semanticVersionB.minor
  if (minorDiff > 0) {
    return minorDiff
  }
  if (minorDiff < 0) {
    return minorDiff
  }

  const patchDiff = semanticVersionA.patch - semanticVersionB.patch
  if (patchDiff > 0) {
    return patchDiff
  }
  if (patchDiff < 0) {
    return patchDiff
  }

  return 0
}
