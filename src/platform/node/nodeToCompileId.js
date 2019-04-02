import { findHighestVersion } from "../../semantic-versioning/index.js"

export const nodeToCompileId = ({ name, version }, groupMap) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { compatibility } = groupMap[compileIdCandidate]
    if (name in compatibility === false) {
      return false
    }
    const versionForGroup = compatibility[name]

    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
