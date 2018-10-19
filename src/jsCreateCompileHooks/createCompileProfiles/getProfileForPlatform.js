import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"

export const platformMatchCompatMap = ({ platformName, platformVersion, compatMap }) => {
  if (platformName in compatMap === false) {
    return false
  }
  const platformVersionForProfile = compatMap[platformName]
  return versionIsBelowOrEqual(platformVersionForProfile, platformVersion)
}

const findProfileForPlatform = (profiles, platformName, platformVersion) => {
  const profileMatchingPlatform = profiles.find(({ compatMap }) => {
    return platformMatchCompatMap({ platformName, platformVersion, compatMap })
  })
  return profileMatchingPlatform
}

export const getProfileForPlatform = (
  { profiles, fallback },
  { platformName, platformVersion },
) => {
  return findProfileForPlatform(profiles, platformName, platformVersion) || fallback
}
