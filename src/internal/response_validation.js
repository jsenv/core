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
  const validity = { isValid: true }
  if (statusValidation) {
    const statusValidity = await checkStatus(response, {
      originalUrl,
      urlTrace,
    })
    mergeValidity(validity, "status", statusValidity)
    if (!validity.isValid) {
      return validity
    }
  }
  if (contentTypeExpected) {
    const contentTypeValidity = await checkContentType(response, {
      originalUrl,
      urlTrace,
      contentTypeExpected,
    })
    mergeValidity(validity, "contentType", contentTypeValidity)
    if (!validity.isValid) {
      return validity
    }
  }
  return validity
}

const mergeValidity = (parentValidity, childValidityName, childValidity) => {
  parentValidity.isValid = childValidity.isValid
  parentValidity.message = childValidity.message
  parentValidity.details = childValidity.details
  parentValidity[childValidityName] = childValidity
}

const checkStatus = async (response, { originalUrl, urlTrace }) => {
  const url = originalUrl || response.url
  const { status } = response
  if (status < 200 || status > 299) {
    return {
      isValid: false,
      message: `invalid response status on url`,
      details: {
        "response status": status,
        ...(response.headers["content-type"] === "application/json"
          ? {
              "response text": JSON.stringify(
                await response.json(),
                null,
                "  ",
              ),
            }
          : {
              "response text": await response.text(),
            }),
        url,
        ...formatUrlTrace(urlTrace),
      },
    }
  }
  return { isValid: true }
}

const checkContentType = async (
  response,
  { originalUrl, urlTrace, contentTypeExpected },
) => {
  const url = originalUrl || response.url
  const responseContentType = response.headers["content-type"] || ""
  const isOk = Array.isArray(contentTypeExpected)
    ? contentTypeExpected.includes(responseContentType)
    : responseContentType === contentTypeExpected
  if (!isOk) {
    return {
      isValid: false,
      message: `invalid "content-type" on url`,
      details: {
        "content-type": `"${responseContentType}"`,
        "expected content-type": formatExpectedContentType(contentTypeExpected),
        url,
        ...formatUrlTrace(urlTrace),
      },
    }
  }

  return {
    isValid: true,
  }
}

const formatExpectedContentType = (contentTypeExpected) => {
  if (Array.isArray(contentTypeExpected)) {
    return contentTypeExpected.map((value) => `"${value}"`).join(`,\n`)
  }

  return `"${contentTypeExpected}"`
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
