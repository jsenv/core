import {
  versionCompare,
  findHighestVersion,
} from "@jsenv/core/src/internal/semantic_versioning/index.js"

export const minRuntimeVersionsToScore = (
  minRuntimeVersions,
  runtimeScoreMap,
) => {
  return Object.keys(minRuntimeVersions).reduce((previous, runtimeName) => {
    const runtimeVersion = minRuntimeVersions[runtimeName]
    return (
      previous +
      scoreFromRuntime({ runtimeName, runtimeVersion, runtimeScoreMap })
    )
  }, 0)
}

const scoreFromRuntime = ({ runtimeName, runtimeVersion, runtimeScoreMap }) => {
  const versionUsageMap = runtimeScoreMap[runtimeName]

  if (!versionUsageMap) {
    return runtimeScoreMap.other || 0
  }

  const versionArray = Object.keys(versionUsageMap)
  if (versionArray.length === 0) {
    return runtimeScoreMap.other || 0
  }

  const versionArrayAscending = versionArray.sort(versionCompare)
  const highestVersion = versionArrayAscending[versionArray.length - 1]

  if (findHighestVersion(runtimeVersion, highestVersion) === runtimeVersion) {
    return versionUsageMap[highestVersion]
  }

  const closestVersion = versionArrayAscending
    .reverse()
    .find(
      (version) =>
        findHighestVersion(runtimeVersion, version) === runtimeVersion,
    )

  if (!closestVersion) {
    return runtimeScoreMap.other || 0
  }

  return versionUsageMap[closestVersion]
}
