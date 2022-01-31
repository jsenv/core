export const parseJsonRessource = (jsonRessource, notifiers, { minify }) => {
  const jsonString = String(jsonRessource.bufferBeforeBuild)
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      jsonRessource.buildEnd(JSON.stringify(JSON.parse(jsonString)))
      return
    }
    jsonRessource.buildEnd(jsonString)
  }
}
