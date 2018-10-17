/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/

import { composeMapToCompose } from "../objectHelper.js"

const normalizeName = (headerName) => {
  headerName = String(headerName)
  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name")
  }

  return headerName.toLowerCase()
}

const normalizeValue = (headerValue) => {
  return String(headerValue)
}

export const headersFromObject = (headersObject) => {
  const headers = {}

  Object.keys(headersObject).forEach((headerName) => {
    headers[normalizeName(headerName)] = normalizeValue(headersObject[headerName])
  })

  return headers
}

// https://gist.github.com/mmazer/5404301
export const headersFromString = (headerString) => {
  const headers = {}

  if (headerString) {
    const pairs = headerString.split("\r\n")
    pairs.forEach((pair) => {
      const index = pair.indexOf(": ")
      if (index > 0) {
        const key = pair.slice(0, index)
        const value = pair.slice(index + 2)
        headers[normalizeName(key)] = normalizeValue(value)
      }
    })
  }

  return headers
}

const headersToArray = (headers) => {
  return Object.keys(headers).map((name) => {
    return {
      name,
      value: headers[name],
    }
  })
}

export const headersToString = (headers, { convertName = (name) => name }) => {
  const headersString = headersToArray(headers).map(({ name, value }) => {
    return `${convertName(name)}: ${value}`
  })

  return headersString.join("\r\n")
}

export const acceptContentType = (acceptHeader, contentType) => {
  if (typeof acceptHeader !== "string") {
    return false
  }
  return acceptHeader.split(",").some((accepted) => accepted === contentType)
}

const composeHeaderValues = (value, nextValue) => `${value}, ${nextValue}`

const headerComposeMap = {
  accept: composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  vary: composeHeaderValues,
}

export const headersCompose = composeMapToCompose(headerComposeMap)
