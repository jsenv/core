import { isNodeBuiltinModule } from "./isNodeBuiltinModule.js"
import { namespaceGetterToRegister } from "../../namespaceGetterToRegister.js"

export const moduleToRegisterGetter = ({
  fetchSource,
  evalSource,
  remoteFile,
  remoteParent,
  localFile,
}) => {
  if (isNodeBuiltinModule(remoteFile)) {
    return namespaceGetterToRegister(() => {
      const nodeBuiltinModuleExports = require(remoteFile) // eslint-disable-line import/no-dynamic-require
      return {
        ...nodeBuiltinModuleExports,
        default: nodeBuiltinModuleExports,
      }
    })
  }

  return fetchSource({ remoteFile, remoteParent, localFile }).then(
    ({ status, reason, headers, body }) => {
      if (status < 200 || status >= 300) {
        return Promise.reject({ status, reason, headers, body })
      }

      if (headers["content-type"] === "application/javascript") {
        return (System) => {
          evalSource(body, { remoteFile, remoteParent, localFile })
          return System.getRegister()
        }
      }

      if (headers["content-type"] === "application/json") {
        return () => {
          return namespaceGetterToRegister(() => {
            return {
              default: JSON.parse(body),
            }
          })
        }
      }

      return () => undefined
    },
  )
}
