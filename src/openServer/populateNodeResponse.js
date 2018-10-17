import { pipe, callCancel, callClose } from "./createConnection/index.js"

const mapping = {
  // "content-length": "Content-Length",
  // "last-modified": "Last-Modified",
}

const headersToNodeHeaders = (headers) => {
  const nodeHeaders = {}

  Object.keys(headers).forEach((name) => {
    const nodeHeaderName = name in mapping ? mapping[name] : name
    nodeHeaders[nodeHeaderName] = headers[name]
  })

  return nodeHeaders
}

export const populateNodeResponse = (
  nodeResponse,
  { status, reason, headers, body },
  { ignoreBody },
) => {
  nodeResponse.writeHead(status, reason, headersToNodeHeaders(headers))
  if (ignoreBody) {
    callCancel(body)
    nodeResponse.end()
  } else {
    pipe(body, nodeResponse)
    nodeResponse.once("close", () => {
      // close body in case nodeResponse is prematurely closed
      // while body is writing
      // it may happen in case of server sent event
      // where body is kept open to write to client
      // and the browser is reloaded or closed for instance
      callClose(body)
    })
  }
}
