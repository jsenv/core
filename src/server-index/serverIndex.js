import { open as serverOpen } from "../server/index.js"

export const open = async ({ cancellationToken, protocol, ip, port, body }) => {
  const indexServer = await serverOpen({
    cancellationToken,
    protocol,
    ip,
    port,
    requestToResponse: () => {
      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(body),
          "cache-control": "no-store",
        },
        body,
      }
    },
  })
  // https://nodejs.org/api/net.html#net_server_unref
  indexServer.nodeServer.unref()
  return indexServer
}
