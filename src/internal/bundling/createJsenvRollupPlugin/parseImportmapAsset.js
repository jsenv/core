export const parseImportmapAsset = ({ source }) => {
  const importmapString = String(source)
  return () => {
    // this is to remove eventual whitespaces
    return JSON.stringify(JSON.parse(importmapString))
  }
}
