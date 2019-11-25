import { startServer, firstService, serveFile } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"

export const startChromiumServer = async ({
  cancellationToken,
  logLevel = "off",

  projectDirectoryUrl,
  chromiumJsFileUrl,
  chromiumHtmlFileUrl,
}) => {
  if (typeof chromiumHtmlFileUrl === "undefined") {
    chromiumHtmlFileUrl = resolveUrl(
      "./src/internal/chromium-launcher/chromium-html-file.html",
      projectDirectoryUrl,
    )
  }
  if (!chromiumHtmlFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium html file must be inside project directory
--- chromium html file url ---
${chromiumHtmlFileUrl}
--- project directory url ---
${chromiumHtmlFileUrl}`)
  }
  await assertFileExists(chromiumHtmlFileUrl)

  if (typeof chromiumJsFileUrl === "undefined") {
    chromiumJsFileUrl = resolveUrl("./helpers/chromium/chromium-js-file.js", projectDirectoryUrl)
  }
  if (!chromiumJsFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium js file must be inside project directory
--- chromium js file url ---
${chromiumJsFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
  await assertFileExists(chromiumJsFileUrl)

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
