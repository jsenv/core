import { findHighestVersion } from "../semantic-versioning/index.js"

export const resolveGroup = ({ name, version }, groupMap) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { runtimeCompatMap } = groupMap[compileIdCandidate]
    if (name in runtimeCompatMap === false) {
      return false
    }
    const versionForGroup = runtimeCompatMap[name]

    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
