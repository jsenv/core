export const parseImportmapAsset = ({ content }, notifiers, { minify }) => {
  const importmapString = String(content.value)
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(importmapString))
    }
    return importmapString
  }
}
