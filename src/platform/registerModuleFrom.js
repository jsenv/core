import { remoteFileToRessource } from "./locaters.js"

export const fromRemoteFile = async ({
  localRoot,
  remoteRoot,
  compileInto,
  compileId,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
  remoteFile,
  remoteParent,
}) => {
  const ressource = remoteFileToRessource(remoteFile, {
    localRoot,
    remoteRoot,
    compileInto,
    compileId,
  })
  const { url, status, statusText, headers, body } = await fetchSource({
    remoteFile,
    remoteParent,
  })

  if (status === 404) {
    throw createNotFoundError({ ressource, remoteFile })
  }

  if (status === 500 && statusText === "parse error") {
    throw createParseError(
      {
        remoteFile,
        remoteParent,
      },
      JSON.parse(body),
    )
  }

  if (status < 200 || status >= 300) {
    throw createResponseError({ status, statusText, headers, body }, { ressource, remoteFile })
  }

  if ("content-type" in headers === false)
    throw new Error(`missing content-type header for ${remoteFile}`)

  const contentType = headers["content-type"]

  if (contentType === "application/javascript") {
    return fromFunctionReturningRegisteredModule(() => {
      return moduleSourceToSystemRegisteredModule(body, {
        localRoot,
        remoteRoot,
        remoteFile: url,
        remoteParent,
        platformSystem,
      })
    })
  }

  if (contentType === "application/json") {
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: JSON.parse(body),
        }
      },
      { remoteFile, remoteParent },
    )
  }

  throw new Error(`unexpected ${contentType} content-type for ${remoteFile}`)
}

const createNotFoundError = ({ ressource, remoteFile }) => {
  return createError(`${ressource} not found`, {
    code: "MODULE_NOT_FOUND_ERROR",
    url: remoteFile,
  })
}

const createParseError = (_, { message, columnNumber, fileName, lineNumber, messageHTML }) => {
  return createError(message, {
    code: "MODULE_PARSE_ERROR",
    columnNumber,
    fileName,
    lineNumber,
    messageHTML,
  })
}

const createResponseError = ({ status }, { ressource, remoteFile }) => {
  return createError(`received status ${status} for ${ressource} at ${remoteFile}`, {
    code: "RESPONSE_ERROR",
  })
}

const createInstantiateError = (error, { remoteFile, remoteParent }) => {
  return createError(`error while instantiating ${remoteFile}`, {
    code: "MODULE_INSTANTIATE_ERROR",
    error,
    url: remoteFile,
    remoteParent,
  })
}

const createError = (message, properties = {}) => {
  const error = new Error(message)
  defineNonEnumerableProperties(error, properties)
  return error
}

const defineNonEnumerableProperties = (object, properties) => {
  Object.keys(properties).forEach((name) => {
    Object.defineProperty(object, name, {
      value: properties[name],
      enumerable: false,
    })
  })
}

export const fromFunctionReturningRegisteredModule = (fn, context) => {
  try {
    return fn()
  } catch (error) {
    return Promise.reject(createInstantiateError(error, context))
  }
}

export const fromFunctionReturningNamespace = (fn, context) => {
  return fromFunctionReturningRegisteredModule(() => {
    // should we compute the namespace here
    // or as it is done below, defer to execute ?
    // I think defer to execute is better
    return [
      [],
      (_export) => {
        return {
          execute: () => {
            _export(fn())
          },
        }
      },
    ]
  }, context)
}
