import { globalAgent } from "https"
import { fetchUrl as serverFetchUrl, headersToObject } from "@jsenv/server"

// ideally we should only pass this to the fetch below
globalAgent.options.rejectUnauthorized = false

export const fetchUrl = async (url, { ignoreHttpsError = true, ...rest } = {}) => {
  const response = await serverFetchUrl(url, { ignoreHttpsError, ...rest })

  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    text: response.text.bind(response),
    json: response.json.bind(response),
    blob: response.blob.bind(response),
    arrayBuffer: response.arrayBuffer.bind(response),
  }
}
