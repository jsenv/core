import { createDetailedMessage } from "@jsenv/logger"
import { urlToContentType } from "@jsenv/server"

import { stringifyUrlTrace } from "./building/url_trace.js"

export const validateResponseStatusIsOk = async (
  response,
  { originalUrl, importer } = {},
) => {
  const { status } = response
  const url = originalUrl || response.url
  const urlName = urlNameFromResponse(response)

  if (status === 404) {
    return {
      valid: false,
      message: createDetailedMessage(`404 on ${urlName}`, {
        [urlName]: url,
        ...formatUrlTrace(importer),
      }),
    }
  }

  if (status === 500) {
    if (response.headers["content-type"] === "application/json") {
      return {
        valid: false,
        message: createDetailedMessage(`error on ${urlName}`, {
          [urlName]: url,
          ...formatUrlTrace(importer),
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
    message: createDetailedMessage(
      `unexpected response status for ${urlName}`,
      {
        [urlName]: url,
        ...formatUrlTrace(importer),
        "response status": status,
        "response text": await response.text(),
      },
    ),
  }
}

const responseStatusIsOk = (responseStatus) => {
  return responseStatus >= 200 && responseStatus < 300
}

const formatUrlTrace = (importer) => {
  if (!importer) {
    return {
      "url trace": undefined,
    }
  }

  if (typeof importer === "function") {
    const trace = importer()
    return {
      "url trace": stringifyUrlTrace(trace),
    }
  }

  return {
    "url trace": importer,
  }
}

const urlNameFromResponse = (response) => {
  const contentType =
    response.headers["content-type"] || urlToContentType(response.url)

  if (contentType === "application/importmap+json") {
    return "importmap url"
  }

  if (contentType === "application/javascript") {
    return "js url"
  }

  return "url"
}
