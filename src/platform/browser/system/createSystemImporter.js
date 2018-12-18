import { createBrowserSystem } from "./createBrowserSystem.js"
import { createImportTracker } from "../../createImportTracker.js"

export const createSystemImporter = (param) => {
  const importTracker = createImportTracker()

  const browserSystem = createBrowserSystem(param)
  window.System = browserSystem

  const importFile = (file) => {
    importTracker.markFileAsImported(file)
    return browserSystem.import(file)
  }

  return { importFile }
}
