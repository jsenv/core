import { startServer, fetchFileSystem } from "@jsenv/server"

export const startFileServer = ({ rootDirectoryUrl }) => {
  return startServer({
    logLevel: "error",
    protocol: "http",
    keepProcessAlive: false,
    requestToResponse: (request) =>
      fetchFileSystem(new URL(request.ressource.slice(1), rootDirectoryUrl), {
        headers: request.headers,
      }),
  })
}
