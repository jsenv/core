import { serveBundle } from "./serveBundle.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { fileUrlToPath, resolveFileUrl, fileUrlToRelativePath } from "../urlUtils.js"

const { serveFile } = import.meta.require("@dmail/server")

const NODE_PLATFORM_CLIENT_PATHNAME = `/.jsenv/node-platform.js`

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

  if (ressource.startsWith(`${NODE_PLATFORM_CLIENT_PATHNAME}__asset__/`)) {
    const fileUrl = resolveFileUrl(ressource.slice(1), compileDirectoryUrl)
    const filePath = fileUrlToPath(fileUrl)
    return serveFile(filePath, {
      method,
      headers,
    })
  }

  if (ressource !== NODE_PLATFORM_CLIENT_PATHNAME) return null

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    relativePathToProjectDirectory: fileUrlToRelativePath(nodePlatformFileUrl, projectDirectoryUrl),
    relativePathToCompileDirectory: ressource.slice(1),
    importDefaultExtension,
    importMapFileRelativePath,
    importReplaceMap: {
      "/.jsenv/node-platform-data.js": () =>
        generateNodePlatformDataSource({
          compileDirectoryRelativePath: fileUrlToRelativePath(
            compileDirectoryUrl,
            projectDirectoryUrl,
          ),
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
