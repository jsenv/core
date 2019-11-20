import { urlToRelativeUrl } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"

export const serveNodePlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
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
  const nodePlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}node-platform.js`
  const nodePlatformCompiledFileUrl = `${projectDirectoryUrl}${nodePlatformCompiledFileRelativeUrl}`
  const nodePlatformCompiledFileServerUrl = `${origin}/${nodePlatformCompiledFileRelativeUrl}`
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(nodePlatformCompiledFileServerUrl)) {
    return null
  }

  return serveBundle({
    cancellationToken,
    logger,

    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl: nodePlatformFileUrl,
    compiledFileUrl: nodePlatformCompiledFileUrl,
    importDefaultExtension,
    format: "commonjs",

    babelPluginMap,
    projectFileRequestedCallback,
    compileServerOrigin,
    compileServerImportMap,
    request,
  })
}
