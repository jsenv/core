import { request } from "node:http"

export const fetchUsingNodeBuiltin = async (
  url,
  { method = "GET", headers = {}, body } = {},
) => {
  const { port, hostname } = new URL(url)

  const nodeRequest = request({
    hostname,
    port,
    method,
    headers: {
      ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
      ...headers,
    },
  })
  if (body) {
    nodeRequest.write(body)
  }
  nodeRequest.end()

  const nodeResponse = await new Promise((resolve, reject) => {
    nodeRequest.on("error", (error) => {
      console.error(`error event triggered on request to ${url}`)
      reject(error)
    })
    nodeRequest.on("response", resolve)
  })

  return {
    url,
    text: () => {
      return readNodeResponseAsText(nodeResponse)
    },
  }
}

const readNodeResponseAsText = async (nodeResponse) => {
  return new Promise((resolve) => {
    // nodeResponse.setEncoding("utf8")
    const bufferArray = []
    nodeResponse.on("data", (chunk) => {
      bufferArray.push(chunk)
    })
    nodeResponse.on("end", () => {
      const bodyAsBuffer = Buffer.concat(bufferArray)
      resolve(bodyAsBuffer.toString())
    })
  })
}
