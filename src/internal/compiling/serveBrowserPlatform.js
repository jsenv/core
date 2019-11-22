import { resolveUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "./serveBundle.js"

export const serveBrowserPlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  jsenvDirectoryUrl,
  importDefaultExtension,
  browserPlatformFileUrl,

  babelPluginMap,
  projectFileRequestedCallback,
  compileServerOrigin,
  outDirectoryRemoteUrl,
  compileServerImportMap,
  request,
}) => {
  const { origin, ressource } = request
  const browserPlatformCompiledFileRemoteUrl = resolveUrl(
    ".jsenv/browser-platform.js",
    outDirectoryRemoteUrl,
  )
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(browserPlatformCompiledFileRemoteUrl)) {
    return null
  }

  const originalFileUrl = browserPlatformFileUrl
  const compiledFileUrl = resolveUrl(`browser-platform.js`, jsenvDirectoryUrl)
  return serveBundle({
    cancellationToken,
    logger,

    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    importDefaultExtension,
    format: "global",

    babelPluginMap,
    projectFileRequestedCallback,
    compileServerOrigin,
    outDirectoryRemoteUrl,
    compileServerImportMap,
    request,
  })
}
