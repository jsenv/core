// https://github.com/node-fetch/node-fetch/blob/8c197f8982a238b3c345c64b17bfa92e16b4f7c4/src/response.js#L1

import { Agent } from "node:https"
import nodeFetch, { Response } from "node-fetch"

import { DATA_URL } from "@jsenv/urls"
import { fetchFileSystem } from "@jsenv/server"
import {
  isFileHandle,
  fileHandleToReadableStream,
} from "@jsenv/server/src/interfacing_with_node/body.js"

export const fetchUrl = async (
  url,
  {
    signal = new AbortController().signal,
    ignoreHttpsError = false,
    canReadDirectory,
    contentTypeMap,
    cacheStrategy,
    method = "GET",
    headers = {},
    ...rest
  } = {},
) => {
  try {
    url = String(new URL(url))
  } catch (e) {
    throw new Error(
      `fetchUrl first argument must be an absolute url, received ${url}`,
    )
  }

  if (url.startsWith("file://")) {
    const responseProperties = await fetchFileSystem(url, {
      signal,
      method,
      headers,
      rootDirectoryUrl: "file://",
      cacheStrategy,
      canReadDirectory,
      contentTypeMap,
      ...rest,
    })
    const responseBody = responseProperties.body

    const response = new Response(
      typeof responseBody === "string"
        ? Buffer.from(responseBody)
        : isFileHandle(responseBody)
        ? fileHandleToReadableStream(responseBody)
        : responseBody,
      {
        url,
        status: responseProperties.status,
        statusText: responseProperties.statusText,
        headers: responseProperties.headers,
      },
    )
    return response
  }

  if (url.startsWith("data:")) {
    const { contentType, base64Flag, data } = DATA_URL.parse(url)
    const body = base64Flag ? Buffer.from(data, "base64") : Buffer.from(data)
    const response = new Response(body, {
      url,
      status: 200,
      headers: {
        "content-type": contentType,
      },
    })
    return response
  }

  const response = await nodeFetch(url, {
    signal,
    method,
    headers,
    ...(ignoreHttpsError && url.startsWith("https")
      ? {
          agent: () => {
            return new Agent({
              rejectUnauthorized: false,
            })
          },
        }
      : {}),
    ...rest,
  })

  return response
}
