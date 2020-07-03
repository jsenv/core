import { createCancellationToken } from "@jsenv/cancellation"
import { fetchUsingXHR } from "./fetchUsingXHR.js"

const fetchNative = async (
  url,
  { cancellationToken = createCancellationToken(), ...options } = {},
) => {
  const abortController = new AbortController()

  let cancelError
  cancellationToken.register((reason) => {
    cancelError = reason
    abortController.abort(reason)
  })

  let response
  try {
    response = await window.fetch(url, {
      signal: abortController.signal,
      ...options,
    })
  } catch (e) {
    if (cancelError && e.name === "AbortError") {
      throw cancelError
    }
    throw e
  }

  return {
    url: response.url,
    status: response.status,
    statusText: "",
    headers: responseToHeaders(response),
    text: () => response.text(),
    json: () => response.json(),
    blob: () => response.blob(),
    arrayBuffer: () => response.arrayBuffer(),
    formData: () => response.formData(),
  }
}

const responseToHeaders = (response) => {
  const headers = {}
  response.headers.forEach((value, name) => {
    headers[name] = value
  })
  return headers
}

export const fetchUrl =
  typeof window.fetch === "function" && typeof window.AbortController === "function"
    ? fetchNative
    : fetchUsingXHR
