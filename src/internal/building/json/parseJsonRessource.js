export const parseJsonRessource = (jsonRessource, notifiers, { minify }) => {
  const jsonString = String(jsonRessource.bufferBeforeBuild)
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(jsonString))
    }
    return jsonString
  }
}
