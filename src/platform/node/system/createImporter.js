import { createNodeSystem } from "./createNodeSystem.js"

export const createImporter = async ({
  importMap,
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
}) => {
  const nodeSystem = await createNodeSystem({
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
