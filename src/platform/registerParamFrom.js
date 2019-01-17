export const fromRemoteFile = async ({
  System,
  fetchSource,
  evalSource,
  remoteFile,
  remoteParent,
  hrefToLocalFile,
}) => {
  const { url, status, statusText, headers, body } = await fetchSource({
    remoteFile,
    remoteParent,
  })

  if (status === 404) {
    throw createNotFoundError(remoteFile)
  }

  if (status === 500 && statusText === "parse error") {
    throw createParseError(remoteFile, remoteParent, JSON.parse(body))
  }

  if (status < 200 || status >= 300) {
    throw createResponseError({ status, statusText, headers, body }, remoteFile)
  }

  if ("content-type" in headers === false)
    throw new Error(`missing content-type header for ${remoteFile}`)

  const contentType = headers["content-type"]

  if (contentType === "application/javascript") {
    return fromFunctionReturningParam(remoteFile, remoteParent, () => {
      debugger
      evalSource(body, { remoteFile, remoteParent, localFile: hrefToLocalFile(url) })
      return System.getRegister()
    })
  }

  if (contentType === "application/json") {
    return fromFunctionReturningNamespace(remoteFile, remoteParent, () => {
      return {
        default: JSON.parse(body),
      }
    })
  }

  throw new Error(`unexpected ${contentType} content-type for ${remoteFile}`)
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

const createResponseError = ({ status }, file) => {
  const responseError = new Error(`received status ${status} for ${file}`)
  responseError.code = "RESPONSE_ERROR"
  return responseError
}

export const fromFunctionReturningParam = (url, parent, fn) => {
  try {
    return fn()
  } catch (error) {
    return Promise.reject(createInstantiateError(url, parent, error))
  }
}

const createInstantiateError = (url, parent, error) => {
  const instantiateError = new Error(`error while instantiating ${url}`)
  instantiateError.code = "MODULE_INSTANTIATE_ERROR"
  instantiateError.error = error
  instantiateError.url = url
  instantiateError.parent = parent
  return instantiateError
}

export const fromFunctionReturningNamespace = (url, parent, fn) => {
  return fromFunctionReturningParam(url, parent, () => {
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
  })
}
