import { serveFile } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"

export const serveBrowserPlatform = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileUrl,
  importDefaultExtension,
  browserPlatformFileUrl,
  babelPluginMap,
  groupMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource, method, headers } = request
  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const requestUrl = `${origin}${ressource}`
  const browserPlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}.jsenv/browser-platform.js`
  const browserPlatformCompiledFileUrl = `${projectDirectoryUrl}${browserPlatformCompiledFileRelativeUrl}`
  const browserPlatformCompiledFileServerUrl = `${origin}/${browserPlatformCompiledFileRelativeUrl}`
  const browserPlatformAssetDirectoryServerUrl = `${browserPlatformCompiledFileServerUrl}__asset__/`

  if (requestUrl.startsWith(browserPlatformAssetDirectoryServerUrl)) {
    return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
      method,
      headers,
    })
  }

  if (!requestUrl.startsWith(browserPlatformCompiledFileServerUrl)) {
    return null
  }

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl: browserPlatformFileUrl,
    compiledFileUrl: browserPlatformCompiledFileUrl,
    importMapFileUrl,
    importDefaultExtension,
    importReplaceMap: {
      "/.jsenv/browser-platform-data.js": () =>
        generateBrowserPlatformDataSource({
          compileDirectoryRelativeUrl,
          groupMap,
          importDefaultExtension,
        }),
    },
    projectFileRequestedCallback,
    babelPluginMap,
    format: "global",
    request,
  })
}

const generateBrowserPlatformDataSource = ({
  compileDirectoryRelativeUrl,
  groupMap,
  importDefaultExtension,
}) => `
export const compileDirectoryRelativeUrl = ${JSON.stringify(compileDirectoryRelativeUrl)}
export const groupMap = ${JSON.stringify(groupMap)}
export const importDefaultExtension = ${JSON.stringify(importDefaultExtension)}`
