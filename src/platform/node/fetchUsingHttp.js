import https from "https"
import fetch from "node-fetch"
import AbortController from "abort-controller"

// ideally we should only pass this to the fetch below
https.globalAgent.options.rejectUnauthorized = false

export const fetchUsingHttp = async (url, { cancellationToken, ...rest } = {}) => {
  const response = await fetch(url, {
    ...(cancellationToken ? { signal: cancellationTokenToAbortSignal(cancellationToken) } : {}),
    ...rest,
  })

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
