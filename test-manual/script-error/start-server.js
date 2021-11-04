import { resolveUrl } from "@jsenv/filesystem"
import { startServer, fetchFileSystem } from "@jsenv/server"

const directoryUrl = resolveUrl("./", import.meta.url)

startServer({
  port: 3689,
  requestToResponse: (request) => {
    return fetchFileSystem(new URL(request.ressource.slice(1), directoryUrl), {
      headers: request.headers,
      canReadDirectory: true,
    })
  },
})
