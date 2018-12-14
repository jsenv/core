export const createImporter = () => {
  const importFile = (file) => {
    // we'll have to check how it behaves if server responds with 500
    // of if it throw on execution
    return import(file)
  }

  return { importFile }
}
