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
      return Promise.reject(createInstantiateError(remoteFile, remoteParent, error))
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
    return Promise.reject(createNotFoundError(remoteFile))
  }

  if (status === 500 && reason === "parse error") {
    return Promise.reject(createParseError(remoteFile, remoteParent, JSON.parse(body)))
  }

  if (status < 200 || status >= 300) {
    // should I create an error instead of rejecting with the response object ?
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

const createInstantiateError = (url, parent, error) => {
  const instantiateError = new Error(`error while instantiating ${url}`)
  instantiateError.code = "MODULE_INSTANTIATE_ERROR"
  instantiateError.error = error
  instantiateError.url = url
  instantiateError.parent = parent
  return instantiateError
}

const createNotFoundError = (url) => {
  const notFoundError = new Error(`${url} not found`)
  notFoundError.code = "MODULE_NOT_FOUND_ERROR"
  return notFoundError
}

const createParseError = (url, parent, data) => {
  const parseError = new Error(data.message)
  parseError.code = "MODULE_PARSE_ERROR"
  parseError.data = data
  return parseError
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
