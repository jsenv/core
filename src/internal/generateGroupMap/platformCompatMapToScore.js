import { versionCompare, findHighestVersion } from "internal/semantic-versioning/index.js"

export const platformCompatMapToScore = (platformCompatMap, platformScoreMap) => {
  return Object.keys(platformCompatMap).reduce((previous, platformName) => {
    const platformVersion = platformCompatMap[platformName]
    return previous + platformToScore(platformName, platformVersion, platformScoreMap)
  }, 0)
}

const platformToScore = (platformName, platformVersion, platformScoreMap) => {
  if (platformName in platformScoreMap === false) return platformScoreMap.other || 0

  const versionUsageMap = platformScoreMap[platformName]
  const versionArray = Object.keys(versionUsageMap)
  if (versionArray.length === 0) return platformScoreMap.other || 0

  const versionArrayAscending = versionArray.sort(versionCompare)
  const highestVersion = versionArrayAscending[versionArray.length - 1]

  if (findHighestVersion(platformVersion, highestVersion) === platformVersion)
    return versionUsageMap[highestVersion]

  const closestVersion = versionArrayAscending
    .reverse()
    .find((version) => findHighestVersion(platformVersion, version) === platformVersion)

  if (!closestVersion) return platformScoreMap.other || 0

  return versionUsageMap[closestVersion]
}
