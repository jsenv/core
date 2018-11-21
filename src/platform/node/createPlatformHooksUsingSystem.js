import https from "https"
import { createNodeSystem } from "./system/createNodeSystem.js"
import { valueInstall } from "./valueInstall.js"

export const createPlatformHooks = ({ hrefToLocalFile, fileToRemoteCompiledFile }) => {
  const nodeSystem = createNodeSystem({ hrefToLocalFile })

  valueInstall(https.globalAgent.options, "rejectUnauthorized", false)
  valueInstall(global, "fetch", fetch)
  valueInstall(global, "System", nodeSystem)

  const executeFile = (file) => {
    return nodeSystem.import(file)
  }

  const isFileImported = (file) => {
    const remoteCompiledFile = fileToRemoteCompiledFile(file)
    return Boolean(nodeSystem.get(remoteCompiledFile))
  }

  return { executeFile, isFileImported }
}
