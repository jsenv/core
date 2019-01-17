import "systemjs/dist/system.js"
import { fromRemoteFile } from "../../registerParamFrom.js"

export const createBrowserSystem = ({ fetchSource, evalSource, hrefToLocalFile }) => {
  const browserSystem = new window.System.constructor()

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
