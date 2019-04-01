import { versionHighest } from "../../semantic-versioning/index.js"
import { objectComposeValue, objectMapValue } from "../../objectHelper.js"

export const composeCompatibility = (compatibility, secondCompatibility) => {
  return objectComposeValue(
    normalizeCompatibilityVersions(compatibility),
    normalizeCompatibilityVersions(secondCompatibility),
    (version, secondVersion) => versionHighest(version, secondVersion),
  )
}

const normalizeCompatibilityVersions = (compatibility) => {
  return objectMapValue(compatibility, (version) => String(version))
}
