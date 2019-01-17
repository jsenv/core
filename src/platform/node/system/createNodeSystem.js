import "systemjs/dist/system.js"
import { fromRemoteFile, fromFunctionReturningNamespace } from "../../registerParamFrom.js"
import { isNodeBuiltinModule } from "./isNodeBuiltinModule.js"

export const createNodeSystem = ({
  fetchSource,
  evalSource,
  fileToRemoteCompiledFile,
  hrefToLocalFile,
}) => {
  const nodeSystem = new global.System.constructor()

  const resolve = nodeSystem.resolve
  nodeSystem.resolve = async (url, parent) => {
    if (url[0] === "/") return fileToRemoteCompiledFile(url.slice(1))
    return resolve(url, parent)
  }

  nodeSystem.instantiate = async (url, parent) => {
    if (isNodeBuiltinModule(url)) {
      return fromFunctionReturningNamespace(url, parent, () => {
        // eslint-disable-next-line import/no-dynamic-require
        const nodeBuiltinModuleExports = require(url)
        return {
          ...nodeBuiltinModuleExports,
          default: nodeBuiltinModuleExports,
        }
      })
    }

    const registerParam = await fromRemoteFile({
      System: nodeSystem,
      fetchSource,
      evalSource,
      remoteFile: url,
      remoteParent: parent,
      localFile: hrefToLocalFile(url),
    })

    return registerParam
  }

  return nodeSystem
}
