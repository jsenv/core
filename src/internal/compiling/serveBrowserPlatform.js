import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"

export const serveBrowserPlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileDirectoryUrl,
  importDefaultExtension,
  browserPlatformFileUrl,

  babelPluginMap,
  projectFileRequestedCallback,
  compileServerOrigin,
  compileServerImportMap,
  request,
}) => {
  const { origin, ressource } = request
  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const browserPlatformCompiledFileServerUrl = `${origin}/${compileDirectoryRelativeUrl}.jsenv/browser-platform.js`
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(browserPlatformCompiledFileServerUrl)) {
    return null
  }

  const originalFileUrl = browserPlatformFileUrl
  const compiledFileUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}browser-platform.js`
  return serveBundle({
    cancellationToken,
    logger,

    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    importDefaultExtension,
    format: "global",

    babelPluginMap,
    projectFileRequestedCallback,
    compileServerOrigin,
    compileServerImportMap,
    request,
  })
}
