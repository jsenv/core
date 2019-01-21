import "systemjs/dist/system.js"
import { fromRemoteFile } from "../../registerParamFrom.js"

export const createBrowserSystem = ({
  fetchSource,
  evalSource,
  fileToRemoteCompiledFile,
  hrefToLocalFile,
}) => {
  const browserSystem = new window.System.constructor()

  const resolve = browserSystem.resolve
  browserSystem.resolve = async (url, parent) => {
    if (url[0] === "/") return fileToRemoteCompiledFile(url.slice(1))
    return resolve(url, parent)
  }

  browserSystem.instantiate = (url, parent) => {
    return fromRemoteFile({
      System: browserSystem,
      fetchSource,
      evalSource,
      remoteFile: url,
      remoteParent: parent,
      hrefToLocalFile,
    })
  }

  return browserSystem
}
