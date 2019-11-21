import { firstService, serveFile } from "@jsenv/server"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { urlIsAsset } from "internal/compiling/urlIsAsset.js"
import { serveBundle } from "internal/compiling/serveBundle.js"

export const serveBrowserSelfExecute = ({
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileUrl,
  importDefaultExtension,
  browserSelfExecuteTemplateFileUrl,
  babelPluginMap,
  request,
  livereloading,
  logger,
}) => {
  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const browserSelfExecuteDirectoryRelativeUrl = `${compileDirectoryRelativeUrl}.jsenv/browser-self-execute/`

  return firstService(
    () => {
      // "/.jsenv/browser-script.js" is written inside browser-client/index.html
      if (request.ressource === "/.jsenv/browser-script.js") {
        return redirectBrowserScriptToCompiledBrowserSelfExecuteFile({
          compileServerOrigin,
          browserSelfExecuteDirectoryRelativeUrl,
          request,
        })
      }
      return null
    },
    () => {
      // dynamic data exists only to retrieve the compile server origin
      // that can be dynamic
      // otherwise the cached bundles would still target the previous compile server origin
      if (
        request.ressource ===
        `/${compileDirectoryRelativeUrl}.jsenv/browser-self-execute-dynamic-data.json`
      ) {
        return serveBrowserSelfExecuteDynamicData({
          compileServerOrigin,
        })
      }
      return null
    },
    () => {
      const { origin, ressource, method, headers } = request
      const requestUrl = `${origin}${ressource}`
      if (urlIsAsset(requestUrl)) {
        return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
          method,
          headers,
        })
      }

      const browserSelfExecuteDirectoryServerUrl = `${origin}/${browserSelfExecuteDirectoryRelativeUrl}`
      if (requestUrl.startsWith(browserSelfExecuteDirectoryServerUrl)) {
        const fileRelativeUrl = urlToRelativeUrl(requestUrl, browserSelfExecuteDirectoryServerUrl)
        return serveBrowserSelfExecuteBundle({
          logger,
          projectDirectoryUrl,
          compileDirectoryUrl,
          importMapFileUrl,
          importDefaultExtension,
          browserSelfExecuteTemplateFileUrl,
          babelPluginMap,
          request,
          fileRelativeUrl,
          livereloading,
        })
      }

      return null
    },
  )
}

const redirectBrowserScriptToCompiledBrowserSelfExecuteFile = ({
  compileServerOrigin,
  browserSelfExecuteDirectoryRelativeUrl,
  request: { origin, headers },
}) => {
  const file = headers.referer.slice(compileServerOrigin.length)
  const browserSelfExecuteCompiledFileServerUrl = `${origin}/${browserSelfExecuteDirectoryRelativeUrl}${file}`

  return {
    status: 307,
    headers: {
      location: browserSelfExecuteCompiledFileServerUrl,
    },
  }
}

const serveBrowserSelfExecuteDynamicData = ({ compileServerOrigin }) => {
  const body = JSON.stringify({
    compileServerOrigin,
  })

  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    },
    body,
  }
}

const serveBrowserSelfExecuteBundle = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  browserSelfExecuteTemplateFileUrl,
  importMapFileUrl,
  importDefaultExtension,
  babelPluginMap,
  request,
  fileRelativeUrl,
  livereloading,
}) => {
  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const compiledFileUrl = `${projectDirectoryUrl}${request.ressource.slice(1)}`
  return serveBundle({
    logger,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    originalFileUrl: browserSelfExecuteTemplateFileUrl,
    compiledFileUrl,
    importDefaultExtension,
    importMapFileUrl,
    importReplaceMap: {
      "/.jsenv/browser-self-execute-static-data.js": () =>
        generateBrowserSelfExecuteStaticDataSource({
          compileDirectoryRelativeUrl,
          fileRelativeUrl,
          livereloading,
        }),
    },
    babelPluginMap,
    format: "global",
    request,
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({
  compileDirectoryRelativeUrl,
  fileRelativeUrl,
  livereloading,
}) => `
export const compileDirectoryRelativeUrl = ${JSON.stringify(compileDirectoryRelativeUrl)}
export const fileRelativeUrl = ${JSON.stringify(fileRelativeUrl)}
export const livereloading = ${JSON.stringify(livereloading)}
`
