import { resolveUrl, resolveDirectoryUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "./serveBundle.js"

export const serveNodePlatform = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  nodePlatformFileUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,

  babelPluginMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource } = request
  const outDirectoryRemoteUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, origin)
  const compiledFileRemoteUrl = resolveUrl(".jsenv/node-platform.js", outDirectoryRemoteUrl)
  const requestUrl = `${origin}${ressource}`
  if (!requestUrl.startsWith(compiledFileRemoteUrl)) {
    return null
  }

  const originalFileUrl = nodePlatformFileUrl
  const outDirectoryUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, projectDirectoryUrl)
  const compiledFileUrl = resolveUrl(`node-platform.js`, outDirectoryUrl)
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

    format: "commonjs",
    babelPluginMap,
    projectFileRequestedCallback,
    request,
  })
}
