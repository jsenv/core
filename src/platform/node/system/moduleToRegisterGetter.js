import { isNodeBuiltinModule } from "./isNodeBuiltinModule.js"

export const moduleToRegisterGetter = async ({
  fetchSource,
  evalSource,
  remoteFile,
  remoteParent,
  localFile,
}) => {
  const wrapGetRegister = (fn) => (...args) => {
    try {
      return fn(...args)
    } catch (error) {
      return Promise.reject({
        code: "MODULE_INSTANTIATE_ERROR",
        error,
        url: remoteFile,
        parent: remoteParent,
      })
    }
  }

  if (isNodeBuiltinModule(remoteFile)) {
    return wrapGetRegister(() => {
      // eslint-disable-next-line import/no-dynamic-require
      const nodeBuiltinModuleExports = require(remoteFile)
      return namespaceToRegister({
        ...nodeBuiltinModuleExports,
        default: nodeBuiltinModuleExports,
      })
    })
  }

  const { status, reason, headers, body } = await fetchSource({
    remoteFile,
    remoteParent,
    localFile,
  })

  if (status === 404) {
    const error = new Error(`${remoteFile} not found`)
    error.code = "MODULE_NOT_FOUND_ERROR"
    return Promise.reject(error)
  }

  if (status === 500 && reason === "parse error") {
    const data = JSON.parse(error.body)
    const error = new Error(data.message)
    error.code = "MODULE_PARSE_ERROR"
    error.data = data
    return Promise.reject(error)
  }

  if (status < 200 || status >= 300) {
    return Promise.reject({ status, reason, headers, body })
  }

  if (headers["content-type"] === "application/javascript") {
    return wrapGetRegister((System) => {
      evalSource(body, { remoteFile, remoteParent, localFile })
      return System.getRegister()
    })
  }

  if (headers["content-type"] === "application/json") {
    return wrapGetRegister(() => {
      return namespaceToRegister({
        default: JSON.parse(body),
      })
    })
  }

  return () => undefined
}

const namespaceToRegister = (namespace) => {
  return [
    [],
    (_export) => {
      return {
        execute: () => {
          _export(namespace())
        },
      }
    },
  ]
}
