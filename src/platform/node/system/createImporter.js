import { createNodeSystem } from "./createNodeSystem.js"

export const createImporter = ({ localRoot, compileInto, compileId, remoteRoot }) => {
  const nodeSystem = createNodeSystem({ localRoot, compileInto, compileId, remoteRoot })

  const importFile = (file) => {
    return nodeSystem.import(file)
  }

  return { importFile }
}
