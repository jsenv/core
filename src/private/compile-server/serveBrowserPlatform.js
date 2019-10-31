import { serveBundle } from "./serveBundle.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { fileUrlToPath, resolveFileUrl, fileUrlToRelativePath } from "../urlUtils.js"

const { serveFile } = import.meta.require("@dmail/server")

const BROWSER_PLATFORM_CLIENT_PATHNAME = `/.jsenv/browser-platform.js`

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
  const { ressource, method, headers } = request

  if (ressource.startsWith(`${BROWSER_PLATFORM_CLIENT_PATHNAME}__asset__/`)) {
    const fileUrl = resolveFileUrl(ressource.slice(1), compileDirectoryUrl)
    const filePath = fileUrlToPath(fileUrl)
    return serveFile(filePath, {
      method,
      headers,
    })
  }
  if (ressource !== BROWSER_PLATFORM_CLIENT_PATHNAME) return null

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileRelativePath: fileUrlToRelativePath(browserPlatformFileUrl, projectDirectoryUrl),
    compiledFileRelativePath: ressource.slice(1),
    importMapFileRelativePath,
    importDefaultExtension,
    importReplaceMap: {
      "/.jsenv/browser-platform-data.js": () =>
        generateBrowserPlatformDataSource({
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
