import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"

export const nodeToCompileId = ({ name, version }, compileMap) => {
  return Object.keys(compileMap).find((id) => {
    const { compatibilityDescription } = compileMap[id]
    if (name in compatibilityDescription === false) {
      return false
    }
    const versionForGroup = compatibilityDescription[name]
    return versionIsBelowOrEqual(versionForGroup, version)
  })
}
