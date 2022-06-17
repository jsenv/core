import { startServer, fetchFileSystem } from "@jsenv/server"

const publicDirectoryUrl = new URL("./public", import.meta.url)

startServer({
  requestToResponse: (request) => {
    return fetchFileSystem(
      new URL(request.ressource.slice(1), publicDirectoryUrl),
      {
        headers: request.headers,
        canReadDirectory: true,
        etagEnabled: true,
        compressionEnabled: true,
        compressionSizeThreshold: 1,
      },
    )
  },
})
