import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"

const platformMatchCompatMap = ({ platformName, platformVersion, compatMap }) => {
  if (platformName in compatMap === false) {
    return false
  }
  const platformVersionForProfile = compatMap[platformName]
  return versionIsBelowOrEqual(platformVersionForProfile, platformVersion)
}

export const platformToCompileId = ({ compatMap, defaultId, platformName, platformVersion }) => {
  const compileId =
    Object.keys(compatMap).find((id) => {
      const platformCompatMap = compatMap[id]
      return platformMatchCompatMap({ platformCompatMap, platformName, platformVersion })
    }) || defaultId

  return compileId
}
