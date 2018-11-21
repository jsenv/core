import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"

export const nodeToCompileId = ({ name, version }, compileMap) => {
  return Object.keys(compileMap).find((id) => {
    const { compatMap } = compileMap[id]
    if (name in compatMap === false) {
      return false
    }
    const versionForGroup = compatMap[name]
    return versionIsBelowOrEqual(versionForGroup, version)
  })
}
