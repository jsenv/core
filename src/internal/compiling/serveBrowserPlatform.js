import { serveFile } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"
import { urlIsAsset } from "./urlIsAsset.js"

export const serveBrowserPlatform = async ({
  cancellationToken,
  logger,
  compileServer,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importDefaultExtension,
  browserPlatformFileUrl,
  babelPluginMap,
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

  const browserPlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}.jsenv/browser-platform.js`
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

    projectFileRequestedCallback,
    request,
    compileServer,
    babelPluginMap,
  })
}
