import { firstService } from "@jsenv/server"
import { serveBrowserSelfExecuteBundle } from "./serveBrowserSelfExecuteBundle.js"

// "/.jsenv/browser-script.js" is written inside browser-client/index.html
const BROWSER_SCRIPT_CLIENT_PATHNAME = "/.jsenv/browser-script.js"
const BROWSER_SELF_EXECUTE_CLIENT_PATHNAME = "/.jsenv/browser-self-execute.js"
const BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME = "/.jsenv/browser-self-execute-dynamic-data.json"

export const serveBrowserSelfExecute = ({
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileRelativePath,
  importDefaultExtension,
  browserSelfExecuteTemplateFileUrl,
  babelPluginMap,
  request,
  livereloading,
  logger,
}) =>
  firstService(
    () =>
      redirectBrowserScriptToBrowserSelfExecute({
        compileServerOrigin,
        request,
      }),
    () =>
      serveBrowserSelfExecuteBundle({
        projectDirectoryUrl,
        compileDirectoryUrl,
        importMapFileRelativePath,
        importDefaultExtension,
        browserSelfExecuteTemplateFileUrl,
        babelPluginMap,
        request,
        livereloading,
        logger,
      }),
    () =>
      serveBrowserSelfExecuteDynamicData({
        compileServerOrigin,
        request,
      }),
  )

const redirectBrowserScriptToBrowserSelfExecute = ({
  compileServerOrigin,
  request: { origin, ressource, headers },
}) => {
  if (ressource !== BROWSER_SCRIPT_CLIENT_PATHNAME) return null

  const file = headers.referer.slice(compileServerOrigin.length)
  return {
    status: 307,
    headers: {
      location: `${origin}${BROWSER_SELF_EXECUTE_CLIENT_PATHNAME}?file=${file}`,
    },
  }
}

const serveBrowserSelfExecuteDynamicData = ({ compileServerOrigin, request: { ressource } }) => {
  if (ressource !== BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME) return null

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
