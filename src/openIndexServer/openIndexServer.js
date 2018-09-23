import { openServer } from "../openServer/openServer.js"

export const openIndexServer = ({ url, body }) => {
  return openServer({ url }).then((server) => {
    server.addRequestHandler(() => {
      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(body),
          "cache-control": "no-store",
        },
        body,
      }
    })
    return { url: server.url, close: server.close }
  })
}
