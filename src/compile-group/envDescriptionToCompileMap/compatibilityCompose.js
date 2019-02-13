import { versionHighest } from "@dmail/project-structure-compile-babel"
import { objectComposeValue, objectMapValue } from "../../objectHelper.js"

export const compatibilityCompose = (compatibility, secondCompatibility) => {
  return objectComposeValue(
    normalizeCompatibilityVersions(compatibility),
    normalizeCompatibilityVersions(secondCompatibility),
    (version, secondVersion) => versionHighest(version, secondVersion),
  )
}

const normalizeCompatibilityVersions = (compatibility) => {
  return objectMapValue(compatibility, (version) => String(version))
}
