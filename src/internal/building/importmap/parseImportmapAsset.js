import { composeTwoImportMaps } from "@jsenv/import-map"

export const parseImportmapAsset = (importmapTarget, notifiers, { minify, importMapToInject }) => {
  const importmapString = String(importmapTarget.targetBuffer)

  return () => {
    if (importMapToInject) {
      const importmapOriginal = JSON.parse(importmapString)
      const importmapFinal = composeTwoImportMaps(importmapOriginal, importMapToInject)
      return minify
        ? valueToCompactJsonString(importmapFinal)
        : valueToReadableJsonString(importmapFinal)
    }

    return minify ? valueToCompactJsonString(JSON.parse(importmapString)) : importmapString
  }
}

// removes eventual whitespace in json
const valueToCompactJsonString = (json) => JSON.stringify(json)

// prefer a readable json when minification is disabled
const valueToReadableJsonString = (json) => JSON.stringify(json, null, "  ")
