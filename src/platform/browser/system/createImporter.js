import { createBrowserSystem } from "./createBrowserSystem.js"
import { createImportTracker } from "../../createImportTracker.js"

export const createImporter = ({ fetchSource, hrefToLocalFile, fileToRemoteCompiledFile }) => {
  const importTracker = createImportTracker()

  const browserSystem = createBrowserSystem({ fetchSource, hrefToLocalFile })
  window.System = browserSystem

  const importFile = (file) => {
    importTracker.markFileAsImported(file)
    return browserSystem.import(file)
  }

  const fileIsImported = (file) => {
    // isFileImported is useful in case the file was imported but is not
    // in System registry because it has a parse error or insantiate error
    if (importTracker.isFileImported(file)) {
      return true
    }
    const remoteCompiledFile = fileToRemoteCompiledFile(file)
    return Boolean(browserSystem.get(remoteCompiledFile))
  }

  return { importFile, fileIsImported }
}
