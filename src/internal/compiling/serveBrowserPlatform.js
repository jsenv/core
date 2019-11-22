import { resolveUrl, resolveDirectoryUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "./serveBundle.js"

export const serveBrowserPlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
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
  const browserPlatformCompiledFileRemoteUrl = resolveUrl(
    ".jsenv/browser-platform.js",
    outDirectoryRemoteUrl,
  )
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(browserPlatformCompiledFileRemoteUrl)) {
    return null
  }

  const originalFileUrl = browserPlatformFileUrl
  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const compiledFileUrl = resolveUrl(`browser-platform.js`, jsenvDirectoryUrl)
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
