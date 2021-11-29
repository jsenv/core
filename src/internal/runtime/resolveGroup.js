import { findHighestVersion } from "../semantic_versioning/index.js"

export const resolveGroup = ({ name, version }, groupMap) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { minRuntimeVersions } = groupMap[compileIdCandidate]
    const versionForGroup = minRuntimeVersions[name]
    if (!versionForGroup) {
      return false
    }
    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
