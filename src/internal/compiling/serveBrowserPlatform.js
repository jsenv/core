import { resolveUrl, resolveDirectoryUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "./serveBundle.js"

export const serveBrowserPlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  browserPlatformFileUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,

  babelPluginMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource } = request
  const outDirectoryRemoteUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, origin)
  const compiledFileRemoteUrl = resolveUrl(".jsenv/browser-platform.js", outDirectoryRemoteUrl)
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(compiledFileRemoteUrl)) {
    return null
  }

  const originalFileUrl = browserPlatformFileUrl
  const outDirectoryUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, projectDirectoryUrl)
  const compiledFileUrl = resolveUrl(`.jsenv/browser-platform.js`, outDirectoryUrl)
  return serveBundle({
    cancellationToken,
    logger,

    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileServerImportMap,
    importDefaultExtension,

    format: "global",
    babelPluginMap,
    projectFileRequestedCallback,
    request,
  })
}
