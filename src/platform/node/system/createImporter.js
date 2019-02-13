import { createNodeSystem } from "./createNodeSystem.js"

export const createImporter = ({ compileInto, sourceOrigin, compileServerOrigin, compileId }) => {
  const nodeSystem = createNodeSystem({
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
  })

  const importFile = (href) => {
    return nodeSystem.import(href)
  }

  return { importFile }
}
