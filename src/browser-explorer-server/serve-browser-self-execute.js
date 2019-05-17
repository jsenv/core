import { uneval } from "@dmail/uneval"
import { serveBundle } from "../bundle-service/index.js"
import { relativePathInception } from "../inception.js"
import { serveFile } from "../file-service/index.js"
import { firstService } from "../server/index.js"
import { ressourceToPathname, ressourceToSearchParamValue } from "../urlHelper.js"
import { serveBrowserClientFolder } from "./server-browser-client-folder.js"

const BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH =
  "/src/browser-explorer-server/browser-self-execute-template.js"
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
  babelConfigMap,
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
        babelConfigMap,
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

  const fileRelativePath = headers.referer.slice(compileServerOrigin.length)
  return {
    status: 307,
    headers: {
      location: `${origin}${BROWSER_SELF_EXECUTE_CLIENT_PATHNAME}?fileRelativePath=${fileRelativePath}`,
    },
  }
}

const serveBrowserSelfExecuteBundle = ({
  projectPathname,
  importMapRelativePath,
  compileIntoRelativePath,
  babelConfigMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }

  const pathname = ressourceToPathname(ressource)
  const fileRelativePath = ressourceToSearchParamValue(ressource, "fileRelativePath")

  if (pathname !== BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH) return null

  return serveBundle({
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    sourceRelativePath: relativePathInception({
      projectPathname,
      relativePath: BROWSER_SELF_EXECUTE_TEMPLATE_RELATIVE_PATH,
    }),
    compileRelativePath: `/.jsenv/browser-self-execute${fileRelativePath}`,
    inlineSpecifierMap: {
      [BROWSER_SELF_EXECUTE_STATIC_DATA_PATHNAME]: () =>
        generateBrowserSelfExecuteStaticDataSource({ fileRelativePath }),
    },
    headers,
    format: "iife",
    babelConfigMap,
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({ fileRelativePath }) =>
  `export const fileRelativePath = ${uneval(fileRelativePath)}`

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
