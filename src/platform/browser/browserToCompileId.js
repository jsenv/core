import { findHighestVersion } from "../../semantic-versioning/index.js"

export const browserToCompileId = ({ name, version }, groupDescription) => {
  return Object.keys(groupDescription).find((compileIdCandidate) => {
    const { compatibility } = groupDescription[compileIdCandidate]

    if (name in compatibility === false) {
      return false
    }
    const versionForGroup = compatibility[name]
    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
