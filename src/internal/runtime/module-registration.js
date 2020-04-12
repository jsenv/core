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

export const fromFunctionReturningRegisteredModule = (fn, { url, importerUrl }) => {
  try {
    return fn()
  } catch (error) {
    throw new Error(`imported module instantiation error.
--- instantiation error stack ---
${error.stack}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }
}

export const fromUrl = async ({
  url,
  importerUrl,
  executionId,
  fetchSource,
  instantiateJavaScript,
}) => {
  const {
    // url: responseUrl is to support redirection
    url: responseUrl,
    status,
    statusText,
    headers,
    body,
  } = await fetchSource({
    url,
    importerUrl,
    executionId,
  })

  if (status === 404) {
    throw new Error(`imported module not found.
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }

  if (status === 500 && headers["content-type"] === "application/json") {
    const bodyObject = JSON.parse(body)
    if (bodyObject.message && bodyObject.filename && "columnNumber" in bodyObject) {
      const error = new Error(`imported module parsing error.
--- parsing error message ---
${bodyObject.message}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
      error.parsingError = bodyObject
      throw error
    }
  }

  if (status < 200 || status >= 300) {
    throw new Error(`imported module response unsupported status.
--- status ---
${status}
--- allowed status
200 to 299
--- statusText ---
${statusText}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }

  const raw = fromFunctionReturningNamespace(
    () => {
      return {
        default: body,
      }
    },
    { url: responseUrl, importerUrl },
  )

  // don't forget to keep it close to https://github.com/systemjs/systemjs/blob/9a15cfd3b7a9fab261e1848b1b2fa343d73afedb/src/extras/module-types.js#L21

  if ("content-type" in headers === false) {
    console.warn(`Module file response has no content-type.
--- url ---
${responseUrl}
--- importer url ---
${importerUrl}`)
    return raw
  }

  const contentType = headers["content-type"]

  if (contentType === "application/javascript") {
    return fromFunctionReturningRegisteredModule(() => instantiateJavaScript(body, responseUrl), {
      url: responseUrl,
      importerUrl,
    })
  }

  if (contentType === "application/json") {
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: typeof body === "string" ? JSON.parse(body) : body,
        }
      },
      { url: responseUrl, importerUrl },
    )
  }

  if (!contentType.startsWith("text/")) {
    console.warn(`Module handled as text because of unexpected content-type.
--- content-type ---
${contentType}
--- expected content-type ---
application/javascript
application/json
text/*
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }

  return raw
}
