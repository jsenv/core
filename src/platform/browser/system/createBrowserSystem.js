import "systemjs/dist/system.js"
import { moduleToRegisterGetter } from "./moduleToRegisterGetter.js"

export const createBrowserSystem = ({ fetchSource, evalSource, hrefToLocalFile }) => {
  const browserSystem = new window.System.constructor()

  browserSystem.instantiate = (url, parent) => {
    return moduleToRegisterGetter({
      fetchSource,
      evalSource,
      remoteFile: url,
      remoteParent: parent,
      localFile: hrefToLocalFile(url),
    }).then((registerGetter) => {
      return registerGetter(browserSystem)
    })
  }

  return browserSystem
}
