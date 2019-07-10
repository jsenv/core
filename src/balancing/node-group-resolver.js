import { findHighestVersion } from "../semantic-versioning/index.js"

export const resolveNodeGroup = ({ groupMap }) => {
  const node = detectNode()
  return nodeToCompileId(node, groupMap)
}

const detectNode = () => {
  return { name: "node", version: process.version.slice(1) }
}

const nodeToCompileId = ({ name, version }, groupMap) => {
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
