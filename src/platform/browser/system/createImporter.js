import { createBrowserSystem } from "./createBrowserSystem.js"
import { createImportTracker } from "../../createImportTracker.js"

export const createImporter = ({ fetchSource, hrefToLocalFile }) => {
  const importTracker = createImportTracker()

  const browserSystem = createBrowserSystem({ fetchSource, hrefToLocalFile })
  window.System = browserSystem

  const importFile = (file) => {
    importTracker.markFileAsImported(file)
    return browserSystem.import(file)
  }

  return { importFile }
}
