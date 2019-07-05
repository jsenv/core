import { basename } from "path"
import { firstService, serveFile } from "@dmail/server"
import { serveBrowserGlobalBundle } from "../bundling/index.js"
import { ressourceToPathname, ressourceToSearchParamValue } from "../urlHelper.js"
import { serveBrowserClientFolder } from "./server-browser-client-folder.js"

// "/.jsenv/browser-script.js" is written inside browser-client/index.html
const BROWSER_SCRIPT_CLIENT_PATHNAME = "/.jsenv/browser-script.js"
const BROWSER_SELF_EXECUTE_CLIENT_PATHNAME = "/.jsenv/browser-self-execute.js"
const BROWSER_SELF_EXECUTE_STATIC_DATA_PATHNAME = "/.jsenv/browser-self-execute-static-data.js"
const BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME = "/.jsenv/browser-self-execute-dynamic-data.json"

export const serveBrowserSelfExecute = ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  browserClientRelativePath,
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
    () =>
      serveBrowserClientFolder({
        projectPathname,
        browserClientRelativePath,
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

const serveBrowserSelfExecuteBundle = ({
  projectPathname,
  importMapRelativePath,
  compileIntoRelativePath,
  browserSelfExecuteTemplateRelativePath,
  babelPluginMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`/.jsenv/browser-self-execute/`)) {
    const assetRelativePath = ressource.slice("/.jsenv/browser-self-execute/".length)
    return serveFile(`${projectPathname}${compileIntoRelativePath}${assetRelativePath}`, {
      method,
      headers,
    })
  }

  const pathname = ressourceToPathname(ressource)
  const file = ressourceToSearchParamValue(ressource, "file")
  const fileRelativePath = `/${file}`

  if (pathname !== BROWSER_SELF_EXECUTE_CLIENT_PATHNAME) return null

  return serveBrowserGlobalBundle({
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    // TODO: browserSelfExecuteTemplateRelativePath must be resolved using importMap
    sourceRelativePath: browserSelfExecuteTemplateRelativePath,
    compileRelativePath: `/.jsenv/browser-self-execute${fileRelativePath}`,
    sourcemapPath: `./browser-self-execute${fileRelativePath}__asset__/${basename(
      fileRelativePath,
    )}.map`,
    specifierDynamicMap: {
      [BROWSER_SELF_EXECUTE_STATIC_DATA_PATHNAME]: () =>
        generateBrowserSelfExecuteStaticDataSource({ fileRelativePath }),
    },
    headers,
    babelPluginMap,
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({ fileRelativePath }) =>
  `export const fileRelativePath = ${JSON.stringify(fileRelativePath)}`

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
