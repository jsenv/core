import { versionIsBelow, versionIsAbove } from "@dmail/project-structure-compile-babel"

const createVersionToUsageScore = (stats) => {
  const versionNames = Object.keys(stats)
  if (versionNames.length === 0) {
    return () => null
  }
  const sortedVersions = versionNames.sort((versionA, versionB) =>
    versionIsBelow(versionA, versionB),
  )
  const highestVersion = sortedVersions.shift()

  return (platformVersion) => {
    if (platformVersion === highestVersion || versionIsAbove(platformVersion, highestVersion)) {
      return stats[highestVersion]
    }
    const closestVersion = sortedVersions.find((version) => {
      return platformVersion === version || versionIsAbove(platformVersion, version)
    })
    return closestVersion ? stats[closestVersion] : null
  }
}

const createPlatformToUsageScore = (stats) => {
  const platformNames = Object.keys(stats)

  const scoreMap = {}
  platformNames.forEach((platformName) => {
    scoreMap[platformName] = createVersionToUsageScore(stats[platformName])
  })

  return (platformName, platformVersion) => {
    if (platformName in scoreMap) {
      const versionScore = scoreMap[platformName](platformVersion)
      return versionScore === null ? stats.other : versionScore
    }
    return stats.other
  }
}

export const createCompatMapToScore = (stats) => {
  const platformToUsageScore = createPlatformToUsageScore(stats)

  const compatMapToScore = (groupCompatMap) => {
    return Object.keys(groupCompatMap).reduce((previous, platformName) => {
      return previous + platformToUsageScore(platformName, groupCompatMap[platformName])
    }, 0)
  }

  return compatMapToScore
}
