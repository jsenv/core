import { versionIsBelow, versionIsAbove } from "@dmail/project-structure-compile-babel"

const platformToUsageScore = (platformName, platformVersion, platformUsageMap) => {
  if (platformName in platformUsageMap === false) {
    return platformUsageMap.other
  }

  const versionUsageMap = platformUsageMap[platformName]
  if (platformVersion in versionUsageMap === false) {
    return platformUsageMap.other
  }

  const versionNames = Object.keys(versionUsageMap)
  if (versionNames.length === 0) {
    return platformUsageMap.other
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
    return platformUsageMap.other
  }

  return versionUsageMap[closestVersion]
}

export const compatMapToUsageScore = (compatMap, platformUsageMap) => {
  return Object.keys(compatMap).reduce((previous, platformName) => {
    const platformVersion = compatMap[platformName]
    return previous + platformToUsageScore(platformName, platformVersion, platformUsageMap)
  }, 0)
}
