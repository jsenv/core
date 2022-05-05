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
    requestToResponse: (request) =>
      fetchFileSystem(new URL(request.ressource.slice(1), rootDirectoryUrl), {
        headers: request.headers,
      }),
    ...rest,
  })
}
