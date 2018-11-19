export const createImportTracker = () => {
  const importedMap = {}

  const markFileAsImported = (file) => {
    importedMap[file] = true
  }

  const isFileImported = (file) => {
    return file in importedMap && importedMap[file] === true
  }

  return { markFileAsImported, isFileImported }
}
