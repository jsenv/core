import { versionIsBelow, versionIsAbove } from "@dmail/project-structure-compile-babel"

export const compatibilityDescriptionToScore = (compatibilityDescription, platformScoring) => {
  return Object.keys(compatibilityDescription).reduce((previous, platformName) => {
    const platformVersion = compatibilityDescription[platformName]
    return previous + platformToScore(platformName, platformVersion, platformScoring)
  }, 0)
}

const platformToScore = (platformName, platformVersion, platformScoring) => {
  if (platformName in platformScoring === false) {
    return platformScoring.other
  }

  const versionUsageMap = platformScoring[platformName]
  const versionNames = Object.keys(versionUsageMap)
  if (versionNames.length === 0) {
    return platformScoring.other
  }

  const sortedVersions = versionNames.sort((versionA, versionB) =>
    versionIsBelow(versionA, versionB),
  )
  const highestVersion = sortedVersions.shift()

  if (platformVersion === highestVersion || versionIsAbove(platformVersion, highestVersion)) {
    return versionUsageMap[highestVersion]
  }

  const closestVersion = sortedVersions.find((version) => {
    return platformVersion === version || versionIsAbove(platformVersion, version)
  })
  if (!closestVersion) {
    return platformScoring.other
  }

  return versionUsageMap[closestVersion]
}
