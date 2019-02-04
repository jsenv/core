import { remoteFileToRessource } from "./locaters.js"

export const fromRemoteFile = async ({
  remoteFile,
  remoteParent,
  localRoot,
  remoteRoot,
  compileInto,
  compileId,
  System,
  fetchSource,
  evalSource,
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
    return fromFunctionReturningParam(() => {
      evalSource(
        body,
        {
          remoteFile: url,
          remoteParent,
          localRoot,
          remoteRoot,
        },
        { remoteFile, remoteParent },
      )
      return System.getRegister()
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
  const notFoundError = new Error(`${ressource} not found`)
  notFoundError.url = remoteFile
  notFoundError.code = "MODULE_NOT_FOUND_ERROR"
  return notFoundError
}

const createParseError = (_, { message, columnNumber, fileName, lineNumber, messageHTML }) => {
  const parseError = new Error(message)
  defineNonEnumerableProperties(parseError, {
    code: "MODULE_PARSE_ERROR",
    columnNumber,
    fileName,
    lineNumber,
    messageHTML,
  })
  return parseError
}

const defineNonEnumerableProperties = (object, properties) => {
  Object.keys(properties).forEach((name) => {
    Object.defineProperty(object, name, {
      value: properties[name],
      enumerable: false,
    })
  })
}

const createResponseError = ({ status }, { ressource, remoteFile }) => {
  const responseError = new Error(`received status ${status} for ${ressource} at ${remoteFile}`)
  responseError.code = "RESPONSE_ERROR"
  return responseError
}

export const fromFunctionReturningParam = (fn, context) => {
  try {
    return fn()
  } catch (error) {
    return Promise.reject(createInstantiateError(error, context))
  }
}

const createInstantiateError = (error, { remoteFile, remoteParent }) => {
  const instantiateError = new Error(`error while instantiating ${remoteFile}`)
  instantiateError.code = "MODULE_INSTANTIATE_ERROR"
  instantiateError.error = error
  instantiateError.url = remoteFile
  instantiateError.remoteParent = remoteParent
  return instantiateError
}

export const fromFunctionReturningNamespace = (fn, context) => {
  return fromFunctionReturningParam(() => {
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
