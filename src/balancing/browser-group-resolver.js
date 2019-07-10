import { findHighestVersion } from "../semantic-versioning/index.js"
import { detect } from "./navigator-detection/index.js"

export const resolveBrowserGroup = ({ groupMap }) => {
  const browser = detect()
  return browserToCompileId(browser, groupMap)
}

const browserToCompileId = ({ name, version }, groupMap) => {
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
