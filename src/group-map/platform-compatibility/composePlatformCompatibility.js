import { findHighestVersion } from "../../semantic-versioning/index.js"
import { objectComposeValue, objectMapValue } from "../../objectHelper.js"

export const composePlatformCompatibility = (
  platformCompatibility,
  secondPlatformCompatibility,
) => {
  return objectComposeValue(
    normalizePlatformCompatibilityVersions(platformCompatibility),
    normalizePlatformCompatibilityVersions(secondPlatformCompatibility),
    (version, secondVersion) => findHighestVersion(version, secondVersion),
  )
}

const normalizePlatformCompatibilityVersions = (platformCompatibility) => {
  return objectMapValue(platformCompatibility, (version) => String(version))
}
