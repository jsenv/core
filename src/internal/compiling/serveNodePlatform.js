import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { resolveUrl } from "internal/urlUtils.js"
import { serveBundle } from "./serveBundle.js"

export const serveNodePlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  jsenvDirectoryUrl,
  importDefaultExtension,
  nodePlatformFileUrl,

  babelPluginMap,
  projectFileRequestedCallback,
  compileServerOrigin,
  outDirectoryRemoteUrl,
  compileServerImportMap,
  request,
}) => {
  const { origin, ressource } = request
  const nodePlatformCompiledFileRemoteUrl = resolveUrl(
    ".jsenv/node-platform.js",
    outDirectoryRemoteUrl,
  )
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(nodePlatformCompiledFileRemoteUrl)) {
    return null
  }

  const originalFileUrl = nodePlatformFileUrl
  const compiledFileUrl = resolveUrl(`node-platform.js`, jsenvDirectoryUrl)
  return serveBundle({
    cancellationToken,
    logger,

    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    importDefaultExtension,
    format: "commonjs",

    babelPluginMap,
    projectFileRequestedCallback,
    compileServerOrigin,
    outDirectoryRemoteUrl,
    compileServerImportMap,
    request,
  })
}
