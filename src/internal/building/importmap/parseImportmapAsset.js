export const parseImportmapAsset = (importmapTarget, notifiers, { minify }) => {
  const importmapString = String(importmapTarget.targetBuffer)
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(importmapString))
    }
    return importmapString
  }
}
