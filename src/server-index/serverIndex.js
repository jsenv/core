import { open as serverOpen } from "../server/index.js"

export const open = ({ protocol, ip, port, body }) => {
  return serverOpen({
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
