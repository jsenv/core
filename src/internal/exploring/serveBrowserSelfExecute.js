import { firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlIsAsset } from "internal/compiling/urlIsAsset.js"
import { serveBundle } from "internal/compiling/serveBundle.js"

export const serveBrowserSelfExecute = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,

  projectFileRequestedCallback,
  request,
  babelPluginMap,
}) => {
  const browserSelfExecuteTemplateFileUrl = resolveUrl(
    "./src/internal/exploring/browserSelfExecuteTemplate.js",
    jsenvCoreDirectoryUrl,
  )

  const browserSelfExecuteDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}browser-self-execute/`
  const browserSelfExecuteDirectoryRemoteUrl = resolveDirectoryUrl(
    browserSelfExecuteDirectoryRelativeUrl,
    request.origin,
  )

  return firstService(
    () => {
      const { ressource, headers, origin } = request
      // "/.jsenv/browser-script.js" is written inside htmlFile
      if (ressource === "/.jsenv/browser-script.js") {
        const file = new URL(headers.referer).searchParams.get("file")
        const browserSelfExecuteCompiledFileRemoteUrl = `${origin}/${browserSelfExecuteDirectoryRelativeUrl}${file}`

        return {
          status: 307,
          headers: {
            location: browserSelfExecuteCompiledFileRemoteUrl,
          },
        }
      }
      return null
    },
    () => {
      // dynamic data exists only to retrieve the compile server origin
      // that can be dynamic
      // otherwise the cached bundles would still target the previous compile server origin
      if (
        request.ressource === `/${jsenvDirectoryRelativeUrl}browser-self-execute-dynamic-data.json`
      ) {
        const body = JSON.stringify({
          compileServerOrigin,
        })

        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      }
      return null
    },
    () => {
      const { origin, ressource, method, headers } = request
      const requestUrl = `${origin}${ressource}`
      if (urlIsAsset(requestUrl)) {
        return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
          method,
          headers,
        })
      }

      if (requestUrl.startsWith(browserSelfExecuteDirectoryRemoteUrl)) {
        const originalFileUrl = browserSelfExecuteTemplateFileUrl
        const compiledFileUrl = `${projectDirectoryUrl}${ressource.slice(1)}`

        return serveBundle({
          cancellationToken,
          logger,

          projectDirectoryUrl,
          originalFileUrl,
          compiledFileUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          compileServerImportMap,
          importDefaultExtension,

          format: "global",
          projectFileRequestedCallback,
          request,
          babelPluginMap,
        })
      }

      return null
    },
  )
}
