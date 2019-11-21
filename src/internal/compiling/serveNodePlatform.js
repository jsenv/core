import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"

export const serveNodePlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileDirectoryUrl,
  importDefaultExtension,
  nodePlatformFileUrl,

  babelPluginMap,
  projectFileRequestedCallback,
  compileServerOrigin,
  compileServerImportMap,
  request,
}) => {
  const { origin, ressource } = request
  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const nodePlatformCompiledFileServerUrl = `${origin}/${compileDirectoryRelativeUrl}.jsenv/node-platform.js`
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(nodePlatformCompiledFileServerUrl)) {
    return null
  }

  const originalFileUrl = nodePlatformFileUrl
  const compiledFileUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}node-platform.js`
  return serveBundle({
    cancellationToken,
    logger,

    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    importDefaultExtension,
    format: "commonjs",

    babelPluginMap,
    projectFileRequestedCallback,
    compileServerOrigin,
    compileServerImportMap,
    request,
  })
}
