import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../CONSTANTS.js"

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

    protocol: "https",
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
          return serveFile(`${projectDirectoryUrl}${request.ressource.slice(1)}`, {
            method: request.method,
            headers: request.headers,
          })
        },
      ),
  })
}
