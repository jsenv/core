import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"

export const nodeToCompileId = ({ name, version }, groupDescription) => {
  return Object.keys(groupDescription).find((compileIdCandidate) => {
    const { compatibility } = groupDescription[compileIdCandidate]
    if (name in compatibility === false) {
      return false
    }
    const versionForGroup = compatibility[name]
    return versionIsBelowOrEqual(versionForGroup, version)
  })
}
