import { resolveUrl } from "@jsenv/util"
import { startServer, serveFile } from "@jsenv/server"

const directoryUrl = resolveUrl("./", import.meta.url)

startServer({
  port: 3689,
  requestToResponse: (request) => {
    return serveFile(request, {
      rootDirectoryUrl: directoryUrl,
      canReadDirectory: true,
    })
  },
})
