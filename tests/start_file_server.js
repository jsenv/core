import {
  startServer,
  fetchFileSystem,
  jsenvServiceErrorHandler,
} from "@jsenv/server"

export const startFileServer = ({
  rootDirectoryUrl,
  debug = false,
  canUseLongTermCache = () => false,
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
              cacheControl: canUseLongTermCache(request)
                ? `private,max-age=3600,immutable` // 1hour
                : "private,max-age=0,must-revalidate",
            },
          ),
      },
    ],
    ...rest,
  })
}
