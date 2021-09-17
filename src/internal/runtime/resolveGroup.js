import { findHighestVersion } from "../semantic-versioning/index.js"

export const resolveGroup = ({ name, version }, groupMap) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { minRuntimeVersions } = groupMap[compileIdCandidate]
    if (name in minRuntimeVersions === false) {
      return false
    }
    const versionForGroup = minRuntimeVersions[name]

    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
