export const parseJsonAsset = (jsonTarget, notifiers, { minify }) => {
  const jsonString = String(jsonTarget.targetBuffer)
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(jsonString))
    }
    return jsonString
  }
}
