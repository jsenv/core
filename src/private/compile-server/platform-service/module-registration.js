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

  if (status === 500 && statusText === "parse error") {
    const parsingError = JSON.parse(body)
    const error = new Error(`imported module parsing error.
--- parsing error message ---
${parsingError.message}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
    error.parsingError = parsingError
    throw error
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

  const asText = fromFunctionReturningNamespace(
    () => {
      return {
        default: JSON.stringify(body),
      }
    },
    { url: responseUrl, importerUrl },
  )

  if ("content-type" in headers === false) {
    console.warn(`Module handled as text because of missing content-type.
--- url ---
${responseUrl}
--- importer url ---
${importerUrl}`)
    return asText
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
          default: JSON.parse(body),
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

  return asText
}
