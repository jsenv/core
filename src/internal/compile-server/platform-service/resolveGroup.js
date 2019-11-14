import { findHighestVersion } from "../../semantic-versioning/index.js"

export const resolveGroup = ({ name, version }, { groupMap }) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { platformCompatMap } = groupMap[compileIdCandidate]
    if (name in platformCompatMap === false) {
      return false
    }
    const versionForGroup = platformCompatMap[name]

    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
