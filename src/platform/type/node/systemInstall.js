import "./fetch-global.js"
import { createNodeSystem } from "@dmail/module-loader"

export const systemInstall = ({ isRemoteCompiledFile, remoteCompiledFileToLocalCompiledFile }) => {
  const urlToFilename = (url) => {
    return isRemoteCompiledFile(url) ? remoteCompiledFileToLocalCompiledFile(url) : url
  }

  const nodeSystem = createNodeSystem({ urlToFilename })
  global.System = nodeSystem
}
