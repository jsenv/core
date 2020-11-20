import { resolveUrl } from "@jsenv/util"
import { startServer, serveFile } from "@jsenv/server"

const directoryUrl = resolveUrl("./", import.meta.url)

startServer({
  port: 3689,
  requestToResponse: (request) => {
    const requestUrl = resolveUrl(request.ressource.slice(1), directoryUrl)
    return serveFile(requestUrl, {
      ...request,
      canReadDirectory: true,
    })
  },
})
