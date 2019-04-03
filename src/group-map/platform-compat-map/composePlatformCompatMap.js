import { findHighestVersion } from "../../semantic-versioning/index.js"
import { objectComposeValue, objectMapValue } from "../../objectHelper.js"

export const composePlatformCompatMap = (platformCompatMap, secondPlatformCompatMap) => {
  return objectComposeValue(
    normalizePlatformCompatMapVersions(platformCompatMap),
    normalizePlatformCompatMapVersions(secondPlatformCompatMap),
    (version, secondVersion) => findHighestVersion(version, secondVersion),
  )
}

const normalizePlatformCompatMapVersions = (platformCompatibility) => {
  return objectMapValue(platformCompatibility, (version) => String(version))
}
