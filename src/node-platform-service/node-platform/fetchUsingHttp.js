import { globalAgent } from "https"
import { createOperation } from "@dmail/cancellation"

const fetch = import.meta.require("node-fetch")
const AbortController = import.meta.require("abort-controller")

// ideally we should only pass this to the fetch below
globalAgent.options.rejectUnauthorized = false

export const fetchUsingHttp = async (url, { cancellationToken, ...rest } = {}) => {
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
