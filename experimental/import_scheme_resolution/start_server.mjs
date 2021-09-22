import { resolveUrl } from "@jsenv/filesystem"
import { startServer, serveFile } from "@jsenv/server"

const directoryUrl = resolveUrl("./", import.meta.url)

await startServer({
  port: 3689,
  requestToResponse: (request) => {
    return serveFile(request, {
      rootDirectoryUrl: directoryUrl,
      canReadDirectory: true,
    })
  },
})
