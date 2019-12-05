import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "internal/CONSTANTS.js"

export const startChromiumServer = async ({
  cancellationToken,
  logLevel = "off",

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  const chromiumJsFileUrl = resolveUrl(
    "./src/internal/chromium-launcher/chromium-js-file.js",
    jsenvCoreDirectoryUrl,
  )
  const chromiumJsFileRelativeUrl = urlToRelativeUrl(chromiumJsFileUrl, projectDirectoryUrl)
  const chromiumBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${chromiumJsFileRelativeUrl}`
  const chromiumBundledJsFileRemoteUrl = `${compileServerOrigin}/${chromiumBundledJsFileRelativeUrl}`

  return startServer({
    cancellationToken,
    logLevel,

    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () => {
          if (request.ressource === "/.jsenv/browser-script.js") {
            return {
              status: 307,
              headers: {
                location: chromiumBundledJsFileRemoteUrl,
              },
            }
          }
          return null
        },
        () => {
          if (request.ressource.startsWith("/node_modules/")) {
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
