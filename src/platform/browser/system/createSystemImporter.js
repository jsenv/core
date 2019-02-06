import { createBrowserSystem } from "./createBrowserSystem.js"
import { createImportTracker } from "../../createImportTracker.js"

export const createSystemImporter = ({ compileInto, compileId, remoteRoot, fetchSource }) => {
  const importTracker = createImportTracker()

  const browserSystem = createBrowserSystem({
    compileInto,
    compileId,
    remoteRoot,
    fetchSource,
  })

  const importFile = (file) => {
    importTracker.markFileAsImported(file)
    return browserSystem.import(file)
  }

  return { importFile }
}
