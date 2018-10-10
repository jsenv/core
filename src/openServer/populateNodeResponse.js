import { pipe, callCancel, callClose } from "./createConnection/index.js"

export const populateNodeResponse = (
  nodeResponse,
  { status, reason, headers, body },
  { ignoreBody },
) => {
  nodeResponse.writeHead(status, reason, headers)
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
