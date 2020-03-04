import { findHighestVersion } from "../semantic-versioning/index.js"

export const resolveGroup = ({ name, version }, { groupMap }) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { runetimeCompatMap } = groupMap[compileIdCandidate]
    if (name in runetimeCompatMap === false) {
      return false
    }
    const versionForGroup = runetimeCompatMap[name]

    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
