import { firstService } from "@dmail/server"
import { serveBrowserSelfExecuteBundle } from "./serve-browser-self-execute-bundle.js"

// "/.jsenv/browser-script.js" is written inside browser-client/index.html
const BROWSER_SCRIPT_CLIENT_PATHNAME = "/.jsenv/browser-script.js"
const BROWSER_SELF_EXECUTE_CLIENT_PATHNAME = "/.jsenv/browser-self-execute.js"
const BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME = "/.jsenv/browser-self-execute-dynamic-data.json"

export const serveBrowserSelfExecute = ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  browserSelfExecuteTemplateRelativePath,
  babelPluginMap,
  request,
}) =>
  firstService(
    () =>
      redirectBrowserScriptToBrowserSelfExecute({
        compileServerOrigin,
        request,
      }),
    () =>
      serveBrowserSelfExecuteBundle({
        projectPathname,
        compileIntoRelativePath,
        importMapRelativePath,
        browserSelfExecuteTemplateRelativePath,
        babelPluginMap,
        request,
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
