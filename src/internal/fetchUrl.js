import { globalAgent } from "https"
import { fetchUrl as serverFetchUrl } from "@jsenv/server"

// ideally we should only pass this to the fetch below
globalAgent.options.rejectUnauthorized = false

export const fetchUrl = async (
  url,
  { simplified = false, ignoreHttpsError = true, ...rest } = {},
) => {
  const response = await serverFetchUrl(url, { simplified, ignoreHttpsError, ...rest })

  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: responseToHeaders(response),
    text: response.text.bind(response),
    json: response.json.bind(response),
    blob: response.blob.bind(response),
    arrayBuffer: response.arrayBuffer.bind(response),
  }
}

const responseToHeaders = (response) => {
  const headers = {}
  response.headers.forEach((value, name) => {
    headers[name] = value
  })
  return headers
}
