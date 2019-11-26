import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { jsenvHtmlFileUrl } from "internal/jsenvHtmlFileUrl.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "internal/CONSTANTS.js"

export const startChromiumServer = async ({
  cancellationToken,
  logLevel = "off",

  projectDirectoryUrl,
  htmlFileUrl = jsenvHtmlFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  if (!htmlFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium html file must be inside project directory
--- chromium html file url ---
${htmlFileUrl}
--- project directory url ---
${htmlFileUrl}`)
  }
  await assertFileExists(htmlFileUrl)

  const chromiumJsFileUrl = resolveUrl(
    "./src/internal/chromium-launcher/chromium-js-file.js",
    jsenvCoreDirectoryUrl,
  )
  await assertFileExists(chromiumJsFileUrl)
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
          if (request.ressource === "/") {
            return {
              status: 307,
              headers: {
                location: `${request.origin}/${urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl)}`,
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
                location: chromiumBundledJsFileRemoteUrl,
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
