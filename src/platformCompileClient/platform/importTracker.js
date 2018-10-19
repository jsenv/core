const importedMap = {}

export const markFileAsImported = (file) => {
  importedMap[file] = true
}

export const isFileImported = (file) => {
  return file in importedMap && importedMap[file] === true
}
