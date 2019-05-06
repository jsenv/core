import { uneval } from "@dmail/uneval"
import { serveBrowserExecute } from "../browser-execute-service/index.js"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveFile } from "../file-service/index.js"
import { firstService } from "../server/index.js"
import { ressourceToPathname, ressourceToSearchParamValue } from "../urlHelper.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { compileJs } from "../compiled-js-service/index.js"

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
        projectFolder,
        compileInto,
        babelConfigMap,
        compileServerOrigin,
        request,
      }),
    () =>
      serveBrowserExecute({
        projectFolder,
        compileServerOrigin,
        browserClientFolderRelative,
        importMapFilenameRelative,
        compileInto,
        babelConfigMap,
        request,
      }),
  )

// "/.jsenv-well-known/browser-script.js" is written inside browser-client/index.html
const WELL_KNOWN_BROWSER_SCRIPT_PATHNAME = "/.jsenv-well-known/browser-script.js"
const WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME = "/.jsenv-well-known/browser-self-execute.js"

const redirectBrowserScriptToBrowserSelfExecute = ({
  compileServerOrigin,
  request: { origin, ressource, headers },
}) => {
  if (ressource !== WELL_KNOWN_BROWSER_SCRIPT_PATHNAME) return null

  const filenameRelative = headers.referer.slice(compileServerOrigin.length)
  return {
    status: 307,
    headers: {
      location: `${origin}${WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME}?filenameRelative=${filenameRelative}`,
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
  if (ressource.startsWith(`${WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

  const pathname = ressourceToPathname(ressource)
  const filenameRelative = ressourceToSearchParamValue(ressource, "filenameRelative")

  if (pathname !== WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME) return null

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: pathname.slice(1),
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSER_EXECUTE_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      ["/.jsenv-well-known/browser-self-execute-static-data.js"]: () =>
        generateBrowserSelfExecuteStaticDataSource({ filenameRelative }),
    },
    headers,
    format: "iife",
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({ filenameRelative }) =>
  `export const filenameRelative = ${uneval(filenameRelative)}`

const serveBrowserSelfExecuteDynamicData = ({
  projectFolder,
  compileInto,
  babelConfigMap,
  compileServerOrigin,
  request: { ressource, headers },
}) => {
  if (ressource !== "/.jsenv-well-known/browser-self-execute-dynamic.data.js") return null

  const filenameRelative = ressource.slice(1)

  return serveCompiledFile({
    projectFolder,
    sourceFilenameRelative: filenameRelative,
    compiledFilenameRelative: `${compileInto}/${filenameRelative}`,
    headers,
    compile: async () => {
      const source = generateBrowserSelfExecuteDynamicDataSource({
        compileInto,
        compileServerOrigin,
      })

      return compileJs({
        projectFolder,
        babelConfigMap,
        filenameRelative,
        filename: `${projectFolder}/${filenameRelative}`,
        outputFilename: `file://${projectFolder}/${compileInto}/${filenameRelative}`,
        source,
      })
    },
    clientCompileCacheStrategy: "none",
  })
}

const generateBrowserSelfExecuteDynamicDataSource = ({
  compileServerOrigin,
  compileInto,
}) => `export const compileServerOrigin = ${uneval(compileServerOrigin)}
export const compileInto = ${uneval(compileInto)}`
