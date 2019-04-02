import { versionCompare, findHighestVersion } from "../../semantic-versioning/index.js"

export const platformCompatibilityToScore = (platformCompatibility, platformScoreMap) => {
  return Object.keys(platformCompatibility).reduce((previous, platformName) => {
    const platformVersion = platformCompatibility[platformName]
    return previous + platformToScore(platformName, platformVersion, platformScoreMap)
  }, 0)
}

const platformToScore = (platformName, platformVersion, platformScoreMap) => {
  if (platformName in platformScoreMap === false) return platformScoreMap.other || 0

  const versionUsageMap = platformScoreMap[platformName]
  const versionNames = Object.keys(versionUsageMap)
  if (versionNames.length === 0) return platformScoreMap.other || 0

  const sortedVersions = versionNames.sort(versionCompare)
  const highestVersion = sortedVersions.shift()

  if (findHighestVersion(platformVersion, highestVersion) === platformVersion)
    return versionUsageMap[highestVersion]

  const closestVersion = sortedVersions.find(
    (version) => findHighestVersion(platformVersion, version) === platformVersion,
  )

  if (!closestVersion) return platformScoreMap.other || 0

  return versionUsageMap[closestVersion]
}
