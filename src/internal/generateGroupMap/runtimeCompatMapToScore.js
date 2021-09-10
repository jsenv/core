import {
  versionCompare,
  findHighestVersion,
} from "../semantic-versioning/index.js"

export const runtimeCompatMapToScore = (runtimeCompatMap, runtimeScoreMap) => {
  return Object.keys(runtimeCompatMap).reduce((previous, runtimeName) => {
    const runtimeVersion = runtimeCompatMap[runtimeName]
    return (
      previous + runtimeToScore(runtimeName, runtimeVersion, runtimeScoreMap)
    )
  }, 0)
}

const runtimeToScore = (runtimeName, runtimeVersion, runtimeScoreMap) => {
  if (runtimeName in runtimeScoreMap === false)
    return runtimeScoreMap.other || 0

  const versionUsageMap = runtimeScoreMap[runtimeName]
  const versionArray = Object.keys(versionUsageMap)
  if (versionArray.length === 0) return runtimeScoreMap.other || 0

  const versionArrayAscending = versionArray.sort(versionCompare)
  const highestVersion = versionArrayAscending[versionArray.length - 1]

  if (findHighestVersion(runtimeVersion, highestVersion) === runtimeVersion)
    return versionUsageMap[highestVersion]

  const closestVersion = versionArrayAscending
    .reverse()
    .find(
      (version) =>
        findHighestVersion(runtimeVersion, version) === runtimeVersion,
    )

  if (!closestVersion) return runtimeScoreMap.other || 0

  return versionUsageMap[closestVersion]
}
