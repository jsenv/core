import { serveFile } from "@jsenv/server"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "src/serveBundle.js"

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
  const nodePlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}.jsenv/node-platform.js`
  const nodePlatformCompiledFileUrl = `${projectDirectoryUrl}${nodePlatformCompiledFileRelativeUrl}`
  const nodePlatformCompiledFileServerUrl = `${origin}/${nodePlatformCompiledFileRelativeUrl}`
  const nodePlatformAssetDirectoryServerUrl = `${nodePlatformCompiledFileServerUrl}__asset__/`

  if (requestUrl.startsWith(nodePlatformAssetDirectoryServerUrl)) {
    return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
      method,
      headers,
    })
  }

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
    importReplaceMap: {
      "/.jsenv/node-platform-data.js": () =>
        generateNodePlatformDataSource({
          compileDirectoryRelativeUrl,
          groupMap,
          importDefaultExtension,
        }),
    },
    projectFileRequestedCallback,
    babelPluginMap,
    format: "commonjs",
    request,
  })
}

const generateNodePlatformDataSource = ({
  compileDirectoryRelativeUrl,
  groupMap,
  importDefaultExtension,
}) => `
export const compileDirectoryRelativeUrl = ${JSON.stringify(compileDirectoryRelativeUrl)}
export const groupMap = ${JSON.stringify(groupMap)}
export const importDefaultExtension = ${JSON.stringify(importDefaultExtension)}`
