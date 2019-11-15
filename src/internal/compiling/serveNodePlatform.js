import { serveFile } from "@jsenv/server"
import { fileUrlToPath, resolveFileUrl, fileUrlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { serveBundle } from "src/serveBundle.js"

const NODE_PLATFORM_RELATIVE_PATH = `.jsenv/node-platform.js`

export const serveNodePlatform = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileRelativePath,
  importDefaultExtension,
  nodePlatformFileUrl,
  babelPluginMap,
  groupMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { ressource, method, headers } = request

  const relativePath = ressource.slice(1)
  const compileDirectoryRelativePath = fileUrlToRelativePath(
    compileDirectoryUrl,
    projectDirectoryUrl,
  )
  const nodePlatformCompiledFileRelativePath = `${compileDirectoryRelativePath}${NODE_PLATFORM_RELATIVE_PATH}`
  const nodePlatformAssetDirectoryRelativePath = `${nodePlatformCompiledFileRelativePath}__asset__/`

  if (relativePath.startsWith(nodePlatformAssetDirectoryRelativePath)) {
    const fileUrl = resolveFileUrl(relativePath, projectDirectoryUrl)
    const filePath = fileUrlToPath(fileUrl)
    return serveFile(filePath, {
      method,
      headers,
    })
  }

  if (!relativePath.startsWith(nodePlatformCompiledFileRelativePath)) {
    return null
  }

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileRelativePath: fileUrlToRelativePath(nodePlatformFileUrl, projectDirectoryUrl),
    compiledFileRelativePath: nodePlatformCompiledFileRelativePath,
    importDefaultExtension,
    importMapFileRelativePath,
    importReplaceMap: {
      "/.jsenv/node-platform-data.js": () =>
        generateNodePlatformDataSource({
          compileDirectoryRelativePath,
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
  compileDirectoryRelativePath,
  groupMap,
  importDefaultExtension,
}) => `
export const compileDirectoryRelativePath = ${JSON.stringify(compileDirectoryRelativePath)}
export const groupMap = ${JSON.stringify(groupMap)}
export const importDefaultExtension = ${JSON.stringify(importDefaultExtension)}`
