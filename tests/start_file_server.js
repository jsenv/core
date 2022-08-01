import {
  startServer,
  fetchFileSystem,
  jsenvServiceErrorHandler,
} from "@jsenv/server"

export const startFileServer = ({
  rootDirectoryUrl,
  debug = false,
  ...rest
}) => {
  return startServer({
    logLevel: debug ? "info" : "error",
    protocol: "http",
    keepProcessAlive: debug,
    port: debug ? 9777 : 0,
    services: [
      jsenvServiceErrorHandler({ sendErrorDetails: true }),
      {
        handleRequest: (request) =>
          fetchFileSystem(
            new URL(request.resource.slice(1), rootDirectoryUrl),
            {
              rootDirectoryUrl,
              canReadDirectory: true,
              headers: request.headers,
            },
          ),
      },
    ],
    ...rest,
  })
}
