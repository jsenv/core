import { hrefToFilenameRelative } from "./hrefToFilenameRelative.js"

export const fromHref = async ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
  href,
  importer,
}) => {
  const { url, status, statusText, headers, body } = await fetchSource({
    href,
    importer,
  })
  const filenameRelative = hrefToFilenameRelative(href, {
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
  })
  const realHref = url

  if (status === 404) {
    throw createNotFoundError({ filenameRelative, href: realHref })
  }

  if (status === 500 && statusText === "parse error") {
    throw createParseError(
      {
        href,
        importer,
      },
      JSON.parse(body),
    )
  }

  if (status < 200 || status >= 300) {
    throw createResponseError(
      { status, statusText, headers, body },
      { filenameRelative, href: realHref },
    )
  }

  if ("content-type" in headers === false)
    throw new Error(`missing content-type header for ${href}`)

  const contentType = headers["content-type"]

  if (contentType === "application/javascript") {
    return fromFunctionReturningRegisteredModule(
      () => {
        return moduleSourceToSystemRegisteredModule(body, {
          compileInto,
          sourceOrigin,
          compileServerOrigin,
          href: realHref,
          importer,
          platformSystem,
        })
      },
      { href: realHref, importer },
    )
  }

  if (contentType === "application/json") {
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: JSON.parse(body),
        }
      },
      { href: realHref, importer },
    )
  }

  throw new Error(`unexpected ${contentType} content-type for ${href}`)
}

const createNotFoundError = ({ filenameRelative, href }) => {
  return createError(`${filenameRelative} not found`, {
    code: "MODULE_NOT_FOUND_ERROR",
    href,
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

const createResponseError = ({ status }, { filenameRelative, href }) => {
  return createError(`received status ${status} for ${filenameRelative} at ${href}`, {
    code: "RESPONSE_ERROR",
  })
}

const createInstantiateError = (error, { href, importer }) => {
  return createError(`error while instantiating ${href}`, {
    code: "MODULE_INSTANTIATE_ERROR",
    error,
    href,
    importer,
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
