import "systemjs/dist/system.js"
import { Script } from "vm"
import { getNamespaceToRegister } from "../../getNamespaceToRegister.js"
import { isNodeBuiltinModule } from "./isNodeBuiltinModule.js"
import { fetchModule } from "./fetchModule.js"

export const createNodeSystem = ({ urlToFilename = (url) => url }) => {
  const nodeSystem = new global.System.constructor()

  nodeSystem.instantiate = (url, parent) => {
    if (isNodeBuiltinModule(url)) {
      return getNamespaceToRegister(() => {
        const nodeBuiltinModuleExports = require(url) // eslint-disable-line import/no-dynamic-require
        return {
          ...nodeBuiltinModuleExports,
          default: nodeBuiltinModuleExports,
        }
      })
    }

    return fetchModule(url, parent).then(({ status, reason, headers, body }) => {
      if (status < 200 || status >= 300) {
        return Promise.reject({ status, reason, headers, body })
      }

      // we're missing JSON.parse here

      // This filename is very important because it allows the engine (like vscode) to be know
      // that the evluated file is in fact on the filesystem
      // (very important for debugging and sourcenap resolution)
      const filename = urlToFilename(url)
      const script = new Script(body, { filename })
      try {
        script.runInThisContext()
      } catch (error) {
        return Promise.reject({
          code: "MODULE_INSTANTIATE_ERROR",
          error,
          url,
          parent,
        })
      }

      return nodeSystem.getRegister()
    })
  }

  return nodeSystem
}
