import { createNodeSystem } from "./createNodeSystem.js"

export const createImporter = ({ compileInto, sourceRootHref, compiledSourceHref, compileId }) => {
  const nodeSystem = createNodeSystem({
    compileInto,
    sourceRootHref,
    compiledSourceHref,
    compileId,
  })

  const importFile = (href) => {
    return nodeSystem.import(href)
  }

  return { importFile }
}
