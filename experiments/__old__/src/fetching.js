import { globalAgent } from "node:https"
import { fetchUrl as serverFetchUrl } from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

// ideally we should only pass this to the fetch below
globalAgent.options.rejectUnauthorized = false

export const fetchUrl = async (
  url,
  { ignoreHttpsError = true, ...rest } = {},
) => {
  const response = await serverFetchUrl(url, {
    ignoreHttpsError,
    ...rest,
  })
  const responseObject = {
    url: response.url,
    type: "default",
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    text: response.text.bind(response),
    json: response.json.bind(response),
    blob: response.blob.bind(response),
    arrayBuffer: response.arrayBuffer.bind(response),
  }
  return responseObject
}
