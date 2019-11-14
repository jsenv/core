import { serveBundle } from "./serveBundle.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { fileUrlToPath, resolveFileUrl, fileUrlToRelativePath } from "../urlUtils.js"

const { serveFile } = import.meta.require("@dmail/server")

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
  const { ressource, method, headers } = request

  const relativePath = ressource.slice(1)
  const compileDirectoryRelativePath = fileUrlToRelativePath(
    compileDirectoryUrl,
    projectDirectoryUrl,
  )
  const browserPlatformCompiledFileRelativePath = `${compileDirectoryRelativePath}${BROWSER_PLATFORM_RELATIVE_PATH}`
  const browserPlatformAssetDirectoryRelativePath = `${browserPlatformCompiledFileRelativePath}__asset__/`

  if (relativePath.startsWith(browserPlatformAssetDirectoryRelativePath)) {
    const fileUrl = resolveFileUrl(relativePath, compileDirectoryUrl)
    const filePath = fileUrlToPath(fileUrl)
    return serveFile(filePath, {
      method,
      headers,
    })
  }

  if (!relativePath.startsWith(browserPlatformCompiledFileRelativePath)) {
    return null
  }

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileRelativePath: fileUrlToRelativePath(browserPlatformFileUrl, projectDirectoryUrl),
    compiledFileRelativePath: browserPlatformCompiledFileRelativePath,
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
