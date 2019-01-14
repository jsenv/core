import stream from "stream"
import { isObservable, subscribe } from "../observable/index.js"
import { nodeStreamToObservable } from "./nodeStreamToObservable.js"
import { valueToObservable } from "./valueToObservable.js"

export const populateNodeResponse = (
  nodeResponse,
  { status, statusText, headers, body },
  { ignoreBody },
) => {
  const nodeHeaders = headersToNodeHeaders(headers)
  // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
  if (statusText === undefined) {
    nodeResponse.writeHead(status, nodeHeaders)
  } else {
    nodeResponse.writeHead(status, statusText, nodeHeaders)
  }
  if (ignoreBody) {
    nodeResponse.end()
    return
  }

  const observable = bodyToObservable(body)
  const subscription = subscribe(observable, {
    next: (data) => {
      nodeResponse.write(data)
    },
    error: (value) => {
      nodeResponse.emit("error", value)
    },
    complete: () => {
      nodeResponse.end()
    },
  })
  nodeResponse.once("close", () => {
    // close body in case nodeResponse is prematurely closed
    // while body is writing
    // it may happen in case of server sent event
    // where body is kept open to write to client
    // and the browser is reloaded or closed for instance
    subscription.unsubscribe()
  })
}

const mapping = {
  // "content-type": "Content-Type",
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

const bodyToObservable = (body) => {
  if (isObservable(body)) return body
  if (isNodeStream(body)) return nodeStreamToObservable(body)
  return valueToObservable(body)
}

const isNodeStream = (value) => {
  if (value === undefined) return false
  if (value instanceof stream.Stream) return true
  if (value instanceof stream.Writable) return true
  if (value instanceof stream.Readable) return true
  return false
}
