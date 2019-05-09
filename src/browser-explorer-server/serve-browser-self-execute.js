import { uneval } from "@dmail/uneval"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../inception.js"
import { serveFile } from "../file-service/index.js"
import { firstService } from "../server/index.js"
import { ressourceToPathname, ressourceToSearchParamValue } from "../urlHelper.js"
import { serveBrowserClientFolder } from "./server-browser-client-folder.js"

export const serveBrowserSelfExecute = ({
  projectFolder,
  compileServerOrigin,
  browserClientFolderRelative,
  importMapFilenameRelative,
  compileInto,
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
        projectFolder,
        importMapFilenameRelative,
        compileInto,
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
        projectFolder,
        browserClientFolderRelative,
        request,
      }),
  )

// "/.jsenv/browser-script.js" is written inside browser-client/index.html
const JSENV_BROWSER_SCRIPT_PATHNAME = "/.jsenv/browser-script.js"
const JSENV_BROWSER_SELF_EXECUTE_PATHNAME = "/.jsenv/browser-self-execute.js"

const redirectBrowserScriptToBrowserSelfExecute = ({
  compileServerOrigin,
  request: { origin, ressource, headers },
}) => {
  if (ressource !== JSENV_BROWSER_SCRIPT_PATHNAME) return null

  const filenameRelative = headers.referer.slice(compileServerOrigin.length)
  return {
    status: 307,
    headers: {
      location: `${origin}${JSENV_BROWSER_SELF_EXECUTE_PATHNAME}?filenameRelative=${filenameRelative}`,
    },
  }
}

const BROWSER_EXECUTE_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browser-explorer-server/browser-self-execute-template.js"

const serveBrowserSelfExecuteBundle = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${JSENV_BROWSER_SELF_EXECUTE_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

  const pathname = ressourceToPathname(ressource)
  const filenameRelative = ressourceToSearchParamValue(ressource, "filenameRelative")

  if (pathname !== JSENV_BROWSER_SELF_EXECUTE_PATHNAME) return null

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: `.jsenv/browser-self-execute/${filenameRelative}`,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSER_EXECUTE_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      ["/.jsenv/browser-self-execute-static-data.js"]: () =>
        generateBrowserSelfExecuteStaticDataSource({ filenameRelative }),
    },
    headers,
    format: "iife",
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({ filenameRelative }) =>
  `export const filenameRelative = ${uneval(filenameRelative)}`

const serveBrowserSelfExecuteDynamicData = ({ compileServerOrigin, request: { ressource } }) => {
  if (ressource !== "/.jsenv/browser-self-execute-dynamic-data.json") return null

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
