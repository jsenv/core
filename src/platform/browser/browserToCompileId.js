import { findHighestVersion } from "../../semantic-versioning/index.js"

export const browserToCompileId = ({ name, version }, groupMap) => {
  return Object.keys(groupMap).find((compileIdCandidate) => {
    const { platformCompatibility } = groupMap[compileIdCandidate]

    if (name in platformCompatibility === false) {
      return false
    }
    const versionForGroup = platformCompatibility[name]
    const highestVersion = findHighestVersion(version, versionForGroup)
    return highestVersion === version
  })
}
