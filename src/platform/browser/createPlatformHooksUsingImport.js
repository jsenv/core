export const createPlatformHooks = () => {
  const importFile = (file) => {
    // we'll have to check how it behaves if server responds with 500
    // of if it throw on execution
    return import(file)
  }

  const fileIsImported = () => {
    // I don't think we can track if the file was imported or not
    return true
  }

  return { importFile, fileIsImported }
}
