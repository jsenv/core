import { createNodeSystem } from "./createNodeSystem.js"
import { valueInstall } from "../valueInstall.js"

export const createImporter = ({ fetchSource, evalSource, hrefToLocalFile }) => {
  const nodeSystem = createNodeSystem({ fetchSource, evalSource, hrefToLocalFile })

  valueInstall(global, "System", nodeSystem)

  const importFile = (file) => {
    return nodeSystem.import(file)
  }

  return { importFile }
}
