export const parseImportmapAsset = ({ source }) => {
  return () => {
    // this is to remove eventual whitespaces
    return JSON.stringify(JSON.parse(source))
  }
}
