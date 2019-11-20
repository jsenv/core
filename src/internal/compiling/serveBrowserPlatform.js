import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"

export const serveBrowserPlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
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
  const requestUrl = `${origin}${ressource}`

  const browserPlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}browser-platform.js`
  const browserPlatformCompiledFileUrl = `${projectDirectoryUrl}${browserPlatformCompiledFileRelativeUrl}`
  const browserPlatformCompiledFileServerUrl = `${origin}/${browserPlatformCompiledFileRelativeUrl}`
  if (!requestUrl.startsWith(browserPlatformCompiledFileServerUrl)) {
    return null
  }

  return serveBundle({
    cancellationToken,
    logger,

    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl: browserPlatformFileUrl,
    compiledFileUrl: browserPlatformCompiledFileUrl,
    importDefaultExtension,
    format: "global",

    babelPluginMap,
    projectFileRequestedCallback,
    compileServerOrigin,
    compileServerImportMap,
    request,
  })
}
