import { open as serverOpen } from "../server/index.js"

export const open = ({ cancellation, protocol, ip, port, body }) => {
  return serverOpen({
    cancellation,
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
}
