import { createNodeSystem } from "./createNodeSystem.js"

export const createImporter = ({ compileInto, sourceOrigin, compiledSourceHref, compileId }) => {
  const nodeSystem = createNodeSystem({
    compileInto,
    sourceOrigin,
    compiledSourceHref,
    compileId,
  })

  const importFile = (href) => {
    return nodeSystem.import(href)
  }

  return { importFile }
}
