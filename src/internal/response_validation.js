import { stringifyUrlTrace } from "./building/url_trace.js"

export const validateResponse = async (
  response,
  {
    originalUrl,
    urlTrace,
    statusValidation = true,
    contentTypeExpected = null,
  } = {},
) => {
  if (statusValidation) {
    const statusValidity = await checkStatus(response, {
      originalUrl,
      urlTrace,
    })
    if (!statusValidity.valid) {
      return statusValidity
    }
  }

  if (contentTypeExpected) {
    const contentTypeValidity = await checkContentType(response, {
      originalUrl,
      urlTrace,
      contentTypeExpected,
    })
    if (!contentTypeValidity.valid) {
      return contentTypeValidity
    }
  }

  return { valid: true }
}

const checkStatus = async (response, { originalUrl, urlTrace }) => {
  const url = originalUrl || response.url
  const { status } = response

  if (status === 404) {
    return {
      valid: false,
      message: `404 on url`,
      details: {
        url,
        ...formatUrlTrace(urlTrace),
      },
    }
  }

  if (status === 500) {
    if (response.headers["content-type"] === "application/json") {
      return {
        valid: false,
        message: `error 500 on url`,
        details: {
          url,
          ...formatUrlTrace(urlTrace),
          error: JSON.stringify(await response.json(), null, "  "),
        },
      }
    }
  }

  if (status < 200 || status > 299) {
    return {
      valid: false,
      message: `invalid response status on url`,
      details: {
        url,
        ...formatUrlTrace(urlTrace),
        "response status": status,
        "response text": await response.text(),
      },
    }
  }

  return { valid: true }
}

const checkContentType = async (
  response,
  { originalUrl, urlTrace, contentTypeExpected },
) => {
  const url = originalUrl || response.url
  const contentType = response.headers["content-type"] || ""

  if (contentType !== contentTypeExpected) {
    return {
      valid: false,
      message: `invalid content-type on url`,
      details: {
        "content-type": contentType,
        "expected content-type": contentTypeExpected,
        url,
        ...formatUrlTrace(urlTrace),
      },
    }
  }

  return {
    valid: true,
  }
}

const formatUrlTrace = (urlTrace) => {
  if (!urlTrace) {
    return {
      "url trace": undefined,
    }
  }

  if (typeof urlTrace === "function") {
    const trace = urlTrace()
    return {
      "url trace": stringifyUrlTrace(trace),
    }
  }

  if (Array.isArray(urlTrace)) {
    return {
      "url trace": stringifyUrlTrace(urlTrace),
    }
  }

  return {
    "url trace": urlTrace,
  }
}
