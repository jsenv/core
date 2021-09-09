import { createDetailedMessage } from "@jsenv/logger"
import { urlToExtension } from "@jsenv/filesystem"

export const validateResponseStatusIsOk = async (response, { originalUrl, importer } = {}) => {
  const { status } = response
  const url = originalUrl || response.url
  const { ressourceName, urlName } = urlToNames(url)

  if (status === 404) {
    return {
      valid: false,
      message: createDetailedMessage(`got 404 on ${ressourceName}`, {
        [urlName]: url,
        "imported by": importer,
      }),
    }
  }

  if (status === 500) {
    if (response.headers["content-type"] === "application/json") {
      return {
        valid: false,
        message: createDetailedMessage(`error on ${ressourceName}`, {
          [urlName]: url,
          "imported by": importer,
          "parse error": JSON.stringify(await response.json(), null, "  "),
        }),
      }
    }
  }

  if (responseStatusIsOk(status)) {
    return { valid: true }
  }

  return {
    valid: false,
    message: createDetailedMessage(`unexpected response status for ${ressourceName}`, {
      "response status": status,
      "response text": await response.text(),
      [urlName]: url,
      "imported by": importer,
    }),
  }
}

const responseStatusIsOk = (responseStatus) => {
  return responseStatus >= 200 && responseStatus < 300
}

const urlToNames = (url) => {
  if (urlToExtension(url) === ".importmap") {
    return {
      ressourceName: "importmap",
      urlName: "importmap url",
    }
  }

  return {
    ressourceName: "url",
    urlName: "url",
  }
}
