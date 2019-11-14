import { globalAgent } from "https"
import { createOperation } from "@jsenv/cancellation"
import { urlToContentType } from "@jsenv/server"
import { readFileContent } from "../../../filesystemUtils.js"
import { fileUrlToPath } from "../../../urlUtils.js"

const fetch = import.meta.require("node-fetch")
const AbortController = import.meta.require("abort-controller")

// ideally we should only pass this to the fetch below
globalAgent.options.rejectUnauthorized = false

export const fetchUrl = async (url, { cancellationToken } = {}) => {
  // this code allow you to have http/https dependency for convenience
  // but maybe we should warn about this.
  // it could also be vastly improved using a basic in memory cache
  if (url.startsWith("http://")) {
    const response = await fetchUsingHttp(url, { cancellationToken })
    return response
  }

  if (url.startsWith("https://")) {
    const response = await fetchUsingHttp(url, { cancellationToken })
    return response
  }

  if (url.startsWith("file:///")) {
    try {
      const path = fileUrlToPath(url)
      const code = await createOperation({
        cancellationToken,
        start: () => readFileContent(path),
      })
      return {
        url,
        status: 200,
        body: code,
        headers: {
          "content-type": urlToContentType(url),
        },
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        return {
          url,
          status: 404,
        }
      }
      return {
        url,
        status: 500,
      }
    }
  }

  throw new Error(`unsupported url: ${url}`)
}

const fetchUsingHttp = async (url, { cancellationToken, ...rest } = {}) => {
  if (cancellationToken) {
    // a cancelled fetch will never resolve, while cancellation api
    // expect to get a rejected promise.
    // createOperation ensure we'll get a promise rejected with a cancelError
    const response = await createOperation({
      cancellationToken,
      start: () =>
        fetch(url, {
          signal: cancellationTokenToAbortSignal(cancellationToken),
          ...rest,
        }),
    })
    return normalizeResponse(response)
  }

  const response = await fetch(url, rest)
  return normalizeResponse(response)
}

const normalizeResponse = async (response) => {
  const text = await response.text()
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: responseToHeaderMap(response),
    body: text,
  }
}

// https://github.com/bitinn/node-fetch#request-cancellation-with-abortsignal
const cancellationTokenToAbortSignal = (cancellationToken) => {
  const abortController = new AbortController()
  cancellationToken.register((reason) => {
    abortController.abort(reason)
  })
  return abortController.signal
}

const responseToHeaderMap = (response) => {
  const headerMap = {}
  response.headers.forEach((value, name) => {
    headerMap[name] = value
  })
  return headerMap
}
