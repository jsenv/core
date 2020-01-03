import { firstService, serveFile } from "@jsenv/server"
import { resolveDirectoryUrl, resolveUrl } from "@jsenv/util"
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
        if (!headers.referer) {
          return {
            status: 400,
            statusText: `referer missing in request headers`,
          }
        }
        let url
        try {
          url = new URL(headers.referer)
        } catch (e) {
          return {
            status: 400,
            statusText: `unexpected referer in request headers, must be an url and received ${headers.referer}`,
          }
        }

        const file = url.searchParams.get("file")

        if (stringHasConcecutiveSlashes(file)) {
          return {
            status: 400,
            statusText: `unexpected file in query string parameters, it contains consecutive slashes ${file}`,
          }
        }
        const browserSelfExecuteCompiledFileRemoteUrl = `${origin}/${browserSelfExecuteDirectoryRelativeUrl}${file}`

        return {
          status: 307,
          headers: {
            location: browserSelfExecuteCompiledFileRemoteUrl,
            vary: "referer",
          },
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

const stringHasConcecutiveSlashes = (string) => {
  let previousCharIsSlash = 0
  let i = 0
  while (i < string.length) {
    const char = string[i]
    i++
    if (char === "/") {
      if (previousCharIsSlash) {
        return true
      }
      previousCharIsSlash = true
    } else {
      previousCharIsSlash = false
    }
  }
  return false
}
