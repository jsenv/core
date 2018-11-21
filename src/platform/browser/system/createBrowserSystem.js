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
      try {
        return registerGetter(browserSystem)
      } catch (error) {
        return Promise.reject({
          code: "MODULE_INSTANTIATE_ERROR",
          error,
          url,
          parent,
        })
      }
    })
  }

  return browserSystem
}
