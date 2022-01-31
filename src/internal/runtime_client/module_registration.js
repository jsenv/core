import { createDetailedMessage } from "@jsenv/logger"

export const fromFunctionReturningNamespace = (fn, data) => {
  return fromFunctionReturningRegisteredModule(() => {
    // should we compute the namespace here
    // or as it is done below, defer to execute ?
    // I think defer to execute is better
    return [
      [],
      (_export) => {
        return {
          execute: () => {
            const namespace = fn()
            _export(namespace)
          },
        }
      },
    ]
  }, data)
}

export const getJavaScriptModuleResponseError = async (
  response,
  {
    url,
    importerUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    jsonContentTypeAccepted,
  },
) => {
  if (response.status === 404) {
    return new Error(
      createDetailedMessage(
        `JavaScript module file cannot be found`,
        getModuleDetails({
          url,
          importerUrl,
          compileServerOrigin,
          compileDirectoryRelativeUrl,
          notFound: true,
        }),
      ),
    )
  }

  const contentType = response.headers["content-type"] || ""
  if (response.status === 500 && contentType === "application/json") {
    const bodyAsJson = await response.json()
    if (
      bodyAsJson.message &&
      bodyAsJson.filename &&
      "columnNumber" in bodyAsJson
    ) {
      const error = new Error(
        createDetailedMessage(`JavaScript module file cannot be parsed`, {
          ["parsing error message"]: bodyAsJson.message,
          ...getModuleDetails({
            url,
            importerUrl,
            compileServerOrigin,
            compileDirectoryRelativeUrl,
          }),
        }),
      )
      error.parsingError = bodyAsJson
      return error
    }
  }

  if (response.status < 200 || response.status >= 300) {
    return new Error(
      createDetailedMessage(
        `JavaScript module file response status is unexpected`,
        {
          ["status"]: response.status,
          ["allowed status"]: "200 to 299",
          ["statusText"]: response.statusText,
          ...getModuleDetails({
            url,
            importerUrl,
            compileServerOrigin,
            compileDirectoryRelativeUrl,
          }),
        },
      ),
    )
  }

  if (
    jsonContentTypeAccepted &&
    (contentType === "application/json" || contentType.endsWith("+json"))
  ) {
    return null
  }

  if (
    contentType !== "application/javascript" &&
    contentType !== "text/javascript"
  ) {
    return new Error(
      createDetailedMessage(
        `Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "${contentType}". Strict MIME type checking is enforced for module scripts per HTML spec.`,
        {
          ...getModuleDetails({
            url,
            importerUrl,
            compileServerOrigin,
            compileDirectoryRelativeUrl,
          }),
          suggestion: `Use import.meta.url or import assertions as documented in https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#How-to-reference-assets`,
        },
      ),
    )
  }

  return null
}

export const fromFunctionReturningRegisteredModule = (fn, data) => {
  try {
    return fn()
  } catch (error) {
    if (error.name === "SyntaxError") {
      throw new Error(
        createDetailedMessage(`Syntax error in module.`, {
          "syntax error stack": error.stack,
          ...getModuleDetails(data),
        }),
      )
    }
    throw new Error(
      createDetailedMessage(`Module instantiation error.`, {
        ["instantiation error stack"]: error.stack,
        ...getModuleDetails(data),
      }),
    )
  }
}

export const getModuleDetails = ({
  url,
  importerUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  notFound = false,
}) => {
  const relativeUrl = tryToFindProjectRelativeUrl(url, {
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })

  const importerRelativeUrl = tryToFindProjectRelativeUrl(importerUrl, {
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })

  const details = notFound
    ? {
        ...(importerUrl
          ? { ["import declared in"]: importerRelativeUrl || importerUrl }
          : {}),
        ...(relativeUrl ? { file: relativeUrl } : {}),
        ["file url"]: url,
      }
    : {
        ...(relativeUrl ? { file: relativeUrl } : {}),
        ["file url"]: url,
        ...(importerUrl
          ? { ["imported by"]: importerRelativeUrl || importerUrl }
          : {}),
      }

  return details
}

export const tryToFindProjectRelativeUrl = (
  url,
  { compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  if (!url) {
    return null
  }

  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return null
  }

  if (url === compileServerOrigin) {
    return null
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length)
  if (!afterOrigin.startsWith(compileDirectoryRelativeUrl)) {
    return null
  }

  const afterCompileDirectory = afterOrigin.slice(
    compileDirectoryRelativeUrl.length,
  )
  return afterCompileDirectory
}

// const textToBase64 =
//   typeof window === "object"
//     ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
//     : (text) => Buffer.from(text, "utf8").toString("base64")
