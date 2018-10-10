import { openServer } from "../openServer/index.js"

export const openIndexServer = ({ url, body }) => {
  return openServer({
    url,
    getResponseForRequest: () => {
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
