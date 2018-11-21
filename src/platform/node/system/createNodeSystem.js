import "systemjs/dist/system.js"
import { moduleToRegisterGetter } from "./moduleToRegisterGetter.js"

export const createNodeSystem = ({ fetchSource, evalSource, hrefToLocalFile }) => {
  const nodeSystem = new global.System.constructor()

  nodeSystem.instantiate = (url, parent) => {
    return moduleToRegisterGetter({
      fetchSource,
      evalSource,
      remoteFile: url,
      remoteParent: parent,
      localFile: hrefToLocalFile(url),
    }).then((registerGetter) => {
      try {
        return registerGetter(nodeSystem)
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

  return nodeSystem
}
