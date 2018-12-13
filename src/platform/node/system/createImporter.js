import { createNodeSystem } from "./createNodeSystem.js"
import { valueInstall } from "../valueInstall.js"

export const createImporter = ({
  fetchSource,
  evalSource,
  hrefToLocalFile,
  fileToRemoteCompiledFile,
}) => {
  const nodeSystem = createNodeSystem({ fetchSource, evalSource, hrefToLocalFile })

  valueInstall(global, "System", nodeSystem)

  const importFile = (file) => {
    return nodeSystem.import(file)
  }

  const isFileImported = (file) => {
    const remoteCompiledFile = fileToRemoteCompiledFile(file)
    return Boolean(nodeSystem.get(remoteCompiledFile))
  }

  return { importFile, isFileImported }
}
