import { versionHighest } from "@dmail/project-structure-compile-babel"
import { objectComposeValue, objectMapValue } from "../../objectHelper.js"

export const compatibilityDescriptionCompose = (compatibilityDescription, secondCompatMap) => {
  return objectComposeValue(
    normalizeCompatMapVersion(compatibilityDescription),
    normalizeCompatMapVersion(secondCompatMap),
    (version, secondVersion) => versionHighest(version, secondVersion),
  )
}

const normalizeCompatMapVersion = (compatibilityDescription) => {
  return objectMapValue(compatibilityDescription, (version) => String(version))
}
