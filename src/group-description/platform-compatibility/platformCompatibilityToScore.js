import { versionCompare, findHighestVersion } from "../../semantic-versioning/index.js"

export const platformCompatibilityToScore = (platformCompatibility, platformScoring) => {
  return Object.keys(platformCompatibility).reduce((previous, platformName) => {
    const platformVersion = platformCompatibility[platformName]
    return previous + platformToScore(platformName, platformVersion, platformScoring)
  }, 0)
}

const platformToScore = (platformName, platformVersion, platformScoring) => {
  if (platformName in platformScoring === false) return platformScoring.other || 0

  const versionUsageMap = platformScoring[platformName]
  const versionNames = Object.keys(versionUsageMap)
  if (versionNames.length === 0) return platformScoring.other || 0

  const sortedVersions = versionNames.sort(versionCompare)
  const highestVersion = sortedVersions.shift()

  if (findHighestVersion(platformVersion, highestVersion) === platformVersion)
    return versionUsageMap[highestVersion]

  const closestVersion = sortedVersions.find(
    (version) => findHighestVersion(platformVersion, version) === platformVersion,
  )

  if (!closestVersion) return platformScoring.other || 0

  return versionUsageMap[closestVersion]
}
