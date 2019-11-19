import { serveFile } from "@jsenv/server"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "src/serveBundle.js"
import { urlIsAsset } from "./urlIsAsset.js"

export const serveNodePlatform = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileUrl,
  importDefaultExtension,
  nodePlatformFileUrl,
  babelPluginMap,
  groupMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource, method, headers } = request
  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const requestUrl = `${origin}${ressource}`
  if (urlIsAsset(requestUrl)) {
    return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
      method,
      headers,
    })
  }

  const nodePlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}.jsenv/node-platform.js`
  const nodePlatformCompiledFileUrl = `${projectDirectoryUrl}${nodePlatformCompiledFileRelativeUrl}`
  const nodePlatformCompiledFileServerUrl = `${origin}/${nodePlatformCompiledFileRelativeUrl}`
  if (!requestUrl.startsWith(nodePlatformCompiledFileServerUrl)) {
    return null
  }

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl: nodePlatformFileUrl,
    compiledFileUrl: nodePlatformCompiledFileUrl,
    importMapFileUrl,
    importDefaultExtension,
    projectFileRequestedCallback,
    babelPluginMap,
    format: "commonjs",
    request,
  })
}
