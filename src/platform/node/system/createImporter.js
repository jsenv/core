import { createNodeSystem } from "./createNodeSystem.js"
import { valueInstall } from "../valueInstall.js"

export const createImporter = (param) => {
  const nodeSystem = createNodeSystem(param)

  valueInstall(global, "System", nodeSystem)

  const importFile = (file) => {
    return nodeSystem.import(file)
  }

  return { importFile }
}
