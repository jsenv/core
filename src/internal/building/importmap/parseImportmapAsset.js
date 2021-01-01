import { composeTwoImportMaps } from "@jsenv/import-map"

export const parseImportmapAsset = (importmapTarget, notifiers, { minify, importMapToInject }) => {
  const importmapString = String(importmapTarget.targetBuffer)

  return () => {
    if (importMapToInject) {
      const importmapOriginal = JSON.parse(importmapString)
      const importmapFinal = composeTwoImportMaps(importmapOriginal, importMapToInject)
      return minify ? JSON.stringify(importmapFinal) : JSON.stringify(importmapFinal, null, "  ")
    }

    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(importmapString))
    }
    return importmapString
  }
}
