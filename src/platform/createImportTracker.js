export const createImportTracker = () => {
  const importedMap = {}

  const markHrefAsImported = (href) => {
    importedMap[href] = true
  }

  const isHrefImported = (href) => {
    return href in importedMap && importedMap[href] === true
  }

  return { markHrefAsImported, isHrefImported }
}
