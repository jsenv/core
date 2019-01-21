import "systemjs/dist/system.js"
import { fromRemoteFile } from "../../registerParamFrom.js"

export const createBrowserSystem = ({
  fetchSource,
  evalSource,
  fileToRemoteFile,
  hrefToLocalFile,
}) => {
  const browserSystem = new window.System.constructor()

  const resolve = browserSystem.resolve
  browserSystem.resolve = async (url, parent) => {
    if (url[0] === "/") return fileToRemoteFile(url.slice(1), parent)
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
