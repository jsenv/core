import { objectComposeValue, objectMapValue } from "../objectHelper.js"

import { versionHighest } from "@dmail/project-structure-compile-babel"

const normalizeCompatMapVersion = (compatMap) => {
  return objectMapValue(compatMap, (version) => String(version))
}

export const compatMapCompose = (compatMap, secondCompatMap) => {
  return objectComposeValue(
    normalizeCompatMapVersion(compatMap),
    normalizeCompatMapVersion(secondCompatMap),
    (version, secondVersion) => versionHighest(version, secondVersion),
  )
}
