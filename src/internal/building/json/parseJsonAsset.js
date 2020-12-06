export const parseJsonAsset = ({ content }, notifiers, { minify }) => {
  const jsonString = String(content.value)
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(jsonString))
    }
    return jsonString
  }
}
