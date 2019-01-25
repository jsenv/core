import "systemjs/dist/system.js"
import { isCoreNodeModuleSpecifier, resolveAbsoluteModuleSpecifier } from "@jsenv/module-resolution"
import { fromRemoteFile, fromFunctionReturningNamespace } from "../../registerParamFrom.js"
import { hrefToMeta } from "../../locaters.js"

export const createNodeSystem = ({
  fetchSource,
  evalSource,
  remoteRoot,
  compileInto,
  compileId,
}) => {
  const nodeSystem = new global.System.constructor()

  const moduleSpecifierFileToCompileId = (moduleSpecifierFile) => {
    if (!moduleSpecifierFile) return null
    const { compileId } = hrefToMeta({ href: moduleSpecifierFile, remoteRoot, compileInto })
    return compileId
  }

  const resolve = nodeSystem.resolve
  nodeSystem.resolve = async (url, parent) => {
    if (url[0] === "/") {
      return resolveAbsoluteModuleSpecifier({
        moduleSpecifier: url,
        file: parent,
        localRoot: `${remoteRoot}/${compileInto}/${moduleSpecifierFileToCompileId(parent) ||
          compileId}`,
      })
    }
    return resolve(url, parent)
  }

  nodeSystem.instantiate = async (url, parent) => {
    if (isCoreNodeModuleSpecifier(url)) {
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
    })

    return registerParam
  }

  return nodeSystem
}
