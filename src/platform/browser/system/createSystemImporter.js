import { createBrowserSystem } from "./createBrowserSystem.js"
import { createImportTracker } from "../../createImportTracker.js"

export const createSystemImporter = ({ compileInto, compiledRootHref, compileId, fetchSource }) => {
  const importTracker = createImportTracker()

  const browserSystem = createBrowserSystem({
    compileInto,
    compiledRootHref,
    compileId,
    fetchSource,
  })

  const importFile = (href) => {
    importTracker.markHrefAsImported(href)
    return browserSystem.import(href)
  }

  return { importFile }
}
