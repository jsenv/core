import { serveFile } from "@jsenv/server"
import { urlToRelativePath } from "internal/urlUtils.js"
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
  const compileDirectoryRelativeUrl = urlToRelativePath(compileDirectoryUrl, projectDirectoryUrl)
  const requestUrl = `${origin}${ressource}`
  const nodePlatformCompiledFileServerUrl = `${origin}/${compileDirectoryRelativeUrl}.jsenv/node-platform.js`
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
    originalFileRelativePath: urlToRelativePath(nodePlatformFileUrl, projectDirectoryUrl),
    compiledFileRelativePath: urlToRelativePath(nodePlatformCompiledFileServerUrl, `${origin}/`),
    importDefaultExtension,
    importMapFileUrl,
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
