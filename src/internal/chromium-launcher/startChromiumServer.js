import { startServer, firstService, serveFile } from "@jsenv/server"
import { urlToRelativeUrl } from "internal/urlUtils.js"

export const startChromiumServer = async ({
  cancellationToken,
  logLevel = "off",

  projectDirectoryUrl,
  chromiumJsFileUrl,
  chromiumHtmlFileUrl,
}) => {
  return startServer({
    cancellationToken,
    logLevel,

    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () => {
          if (request.ressource === "/") {
            return {
              status: 307,
              headers: {
                location: `${request.origin}/${urlToRelativeUrl(
                  chromiumHtmlFileUrl,
                  projectDirectoryUrl,
                )}`,
              },
            }
          }
          return null
        },
        () => {
          if (request.ressource === "/.jsenv/browser-script.js") {
            return {
              status: 307,
              headers: {
                location: `${request.origin}/${urlToRelativeUrl(
                  chromiumJsFileUrl,
                  projectDirectoryUrl,
                )}`,
              },
            }
          }
          return null
        },
        () => {
          if (request.ressource.startsWith("/node_modules/source-map/")) {
            const specifier = request.ressource.slice("/node_modules/".length)
            const filePath = import.meta.require.resolve(specifier)
            return serveFile(filePath, {
              method: request.method,
              headers: request.headers,
            })
          }
          return null
        },
        () => {
          return serveFile(`${projectDirectoryUrl}${request.ressource.slice(1)}`, {
            method: request.method,
            headers: request.headers,
          })
        },
      ),
  })
}
