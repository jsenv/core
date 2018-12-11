import "systemjs/dist/system.js"
import { moduleToRegisterGetter } from "./moduleToRegisterGetter.js"

export const createNodeSystem = ({ fetchSource, evalSource, hrefToLocalFile }) => {
  const nodeSystem = new global.System.constructor()

  nodeSystem.instantiate = async (url, parent) => {
    const registerGetter = await moduleToRegisterGetter({
      fetchSource,
      evalSource,
      remoteFile: url,
      remoteParent: parent,
      localFile: hrefToLocalFile(url),
    })

    return registerGetter(nodeSystem)
  }

  return nodeSystem
}
