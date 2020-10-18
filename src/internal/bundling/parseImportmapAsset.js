export const parseImportmapAsset = ({ content }) => {
  const importmapString = String(content.value)
  return () => {
    // this is to remove eventual whitespaces
    return JSON.stringify(JSON.parse(importmapString))
  }
}
