import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../CONSTANTS.js"

export const startBrowserServer = async ({
  cancellationToken,
  logLevel = "off",

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  const browserJsFileUrl = resolveUrl(
    "./src/internal/browser-launcher/browser-js-file.js",
    jsenvCoreDirectoryUrl,
  )
  const browserjsFileRelativeUrl = urlToRelativeUrl(browserJsFileUrl, projectDirectoryUrl)
  const browserBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserjsFileRelativeUrl}`
  const browserBundledJsFileRemoteUrl = `${compileServerOrigin}/${browserBundledJsFileRelativeUrl}`

  return startServer({
    cancellationToken,
    logLevel,

    // should be reuse compileServerOrigin protocol ?
    // should we reuse compileServer privateKey/certificate ?
    protocol: "https",
    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () => {
          if (request.ressource === "/.jsenv/browser-script.js") {
            return {
              status: 307,
              headers: {
                location: browserBundledJsFileRemoteUrl,
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
