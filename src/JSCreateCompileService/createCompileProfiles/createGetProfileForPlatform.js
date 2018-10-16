import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"

const findProfileForPlatform = (groups, platformName, platformVersion) => {
  const profileMatchingPlatform = groups.find(({ compatMap }) => {
    if (platformName in compatMap === false) {
      return false
    }
    const platformVersionForProfile = compatMap[platformName]
    return versionIsBelowOrEqual(platformVersionForProfile, platformVersion)
  })
  return profileMatchingPlatform
}

export const findProfileMatching = ({ profiles, fallback }, predicate) => {
  return profiles.find(predicate) || fallback
}

export const createGetProfileForPlatform = ({ profiles, fallback }) => {
  return ({ platformName, platformVersion }) => {
    return findProfileForPlatform(profiles, platformName, platformVersion) || fallback
  }
}
