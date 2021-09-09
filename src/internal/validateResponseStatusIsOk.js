import { createDetailedMessage } from "@jsenv/logger"
import { urlToFileSystemPath } from "@jsenv/filesystem"
import { urlToContentType } from "@jsenv/server"

export const validateResponseStatusIsOk = async (response, { originalUrl, importer } = {}) => {
  const { status } = response
  const url = originalUrl || response.url
  const urlName = urlNameFromResponse(response)

  if (status === 404) {
    return {
      valid: false,
      message: createDetailedMessage(`got 404 on ${urlName}`, {
        [urlName]: url,
        "imported by": importerToLog(importer),
      }),
    }
  }

  if (status === 500) {
    if (response.headers["content-type"] === "application/json") {
      return {
        valid: false,
        message: createDetailedMessage(`error on ${urlName}`, {
          [urlName]: url,
          "imported by": importerToLog(importer),
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
    message: createDetailedMessage(`unexpected response status for ${urlName}`, {
      [urlName]: url,
      "imported by": importerToLog(importer),
      "response status": status,
      "response text": await response.text(),
    }),
  }
}

const responseStatusIsOk = (responseStatus) => {
  return responseStatus >= 200 && responseStatus < 300
}

const importerToLog = (importer) => {
  if (importer.startsWith("file://")) {
    if (importer.includes("\n")) {
      // it happens when importer is a source location.
      // In that case string starts with file:// but is not a file url
      // It contains information that looks like an error stack trace
      return importer
    }
    return urlToFileSystemPath(importer)
  }
  return importer
}

const urlNameFromResponse = (response) => {
  const contentType = response.headers["content-type"] || urlToContentType(response.url)

  if (contentType === "application/importmap+json") {
    return "importmap url"
  }

  if (contentType === "application/javascript") {
    return "js url"
  }

  return "url"
}
