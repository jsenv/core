import { openServer } from "../openServer/openServer.js"

export const openIndexServer = ({ url, body }) => {
  return openServer({ url }).then((server) => {
    server.addRequestHandler((request, response) => {
      response.writeHead(200, {
        "content-type": "text/html",
        "content-length": Buffer.byteLength(body),
        "cache-control": "no-store",
      })
      response.end(body)
    })
    return { url: String(server.url), close: server.close }
  })
}
