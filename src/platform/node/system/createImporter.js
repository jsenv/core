import { createNodeSystem } from "./createNodeSystem.js"

export const createImporter = ({
  importMap,
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
}) => {
  const nodeSystem = createNodeSystem({
    importMap,
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
