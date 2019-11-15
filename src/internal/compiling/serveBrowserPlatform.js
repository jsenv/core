import { serveFile } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlToRelativePath } from "internal/urlUtils.js"
import { serveBundle } from "src/serveBundle.js"

const BROWSER_PLATFORM_RELATIVE_PATH = `.jsenv/browser-platform.js`

export const serveBrowserPlatform = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileRelativePath,
  importDefaultExtension,
  browserPlatformFileUrl,
  babelPluginMap,
  groupMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource, method, headers } = request

  const compileDirectoryRelativePath = urlToRelativePath(compileDirectoryUrl, projectDirectoryUrl)
  const requestUrl = `${origin}${ressource}`
  const browserPlatformCompiledFileServerUrl = `${origin}/${compileDirectoryRelativePath}${BROWSER_PLATFORM_RELATIVE_PATH}`
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
    originalFileRelativePath: urlToRelativePath(browserPlatformFileUrl, projectDirectoryUrl),
    compiledFileRelativePath: urlToRelativePath(browserPlatformCompiledFileServerUrl, `${origin}/`),
    importMapFileRelativePath,
    importDefaultExtension,
    importReplaceMap: {
      "/.jsenv/browser-platform-data.js": () =>
        generateBrowserPlatformDataSource({
          compileDirectoryRelativePath,
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
  compileDirectoryRelativePath,
  groupMap,
  importDefaultExtension,
}) => `
export const compileDirectoryRelativePath = ${JSON.stringify(compileDirectoryRelativePath)}
export const groupMap = ${JSON.stringify(groupMap)}
export const importDefaultExtension = ${JSON.stringify(importDefaultExtension)}`
