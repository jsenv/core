// import { basename } from "path"
import { serveFile, urlToSearchParamValue } from "@jsenv/server"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { fileUrlToRelativePath, resolveFileUrl } from "../urlUtils.js"
import { serveBundle } from "../compile-server/serveBundle.js"

const BROWSER_SELF_EXECUTE_RELATIVE_PATH = ".jsenv/browser-self-execute.js"

export const serveBrowserSelfExecuteBundle = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  browserSelfExecuteTemplateFileUrl,
  importMapFileRelativePath,
  importDefaultExtension,
  babelPluginMap,
  request,
  livereloading,
  logger,
}) => {
  const { ressource, method, headers } = request

  const pathname = ressourceToPathname(ressource)
  const relativePath = pathname.slice(1)
  const compileDirectoryRelativePath = fileUrlToRelativePath(
    compileDirectoryUrl,
    projectDirectoryUrl,
  )

  const browserSeflExecuteCompiledFileRelativePath = `${compileDirectoryRelativePath}${BROWSER_SELF_EXECUTE_RELATIVE_PATH}`
  const browserSelfExecuteAssetDirectoryRelativePath = `${browserSeflExecuteCompiledFileRelativePath}__asset__/`

  if (relativePath.startsWith(browserSelfExecuteAssetDirectoryRelativePath)) {
    const fileUrl = resolveFileUrl(relativePath, compileDirectoryUrl)
    return serveFile(fileUrl, {
      method,
      headers,
    })
  }

  if (!relativePath.startsWith(browserSeflExecuteCompiledFileRelativePath)) {
    return null
  }

  const file = urlToSearchParamValue(ressource, "file")
  const fileRelativePath = `/${file}`
  const compiledFileRelativePath = `/.jsenv/browser-self-execute${fileRelativePath}`
  // const sourcemapRelativePath = `${compileRelativePath}__asset__/${basename(fileRelativePath)}.map`

  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileRelativePath: fileUrlToRelativePath(
      browserSelfExecuteTemplateFileUrl,
      projectDirectoryUrl,
    ),
    compiledFileRelativePath,
    importDefaultExtension,
    importMapFileRelativePath,
    importReplaceMap: {
      "/.jsenv/browser-self-execute-static-data.js": () =>
        generateBrowserSelfExecuteStaticDataSource({ fileRelativePath, livereloading }),
    },
    babelPluginMap,
    format: "global",
    request,
  })
}

const ressourceToPathname = (ressource) => {
  return new URL(ressource, "file://").pathname
}

const generateBrowserSelfExecuteStaticDataSource = ({ fileRelativePath, livereloading }) =>
  `export const fileRelativePath = ${JSON.stringify(fileRelativePath)}
export const livereloading = ${JSON.stringify(livereloading)}`
