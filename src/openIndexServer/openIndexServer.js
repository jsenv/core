import { openServer } from "../openServer/index.js"

export const openIndexServer = ({ protocol, ip, port, body }) => {
  return openServer({
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
