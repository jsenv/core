import { startServer, fetchFileSystem } from "@jsenv/server"

export const startFileServer = ({
  rootDirectoryUrl,
  debug = false,
  ...rest
}) => {
  return startServer({
    logLevel: debug ? "info" : "error",
    protocol: "http",
    keepProcessAlive: debug,
    sendErrorDetails: true,
    requestToResponse: (request) =>
      fetchFileSystem(new URL(request.ressource.slice(1), rootDirectoryUrl), {
        rootDirectoryUrl,
        canReadDirectory: true,
        headers: request.headers,
      }),
    ...rest,
  })
}
