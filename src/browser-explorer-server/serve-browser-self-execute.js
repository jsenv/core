import { uneval } from "@dmail/uneval"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { WELL_KNOWN_SYSTEM_PATHNAME } from "../compile-server/system-service/index.js"
import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"
import { WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME } from "./serve-browser-self-execute-dynamic-data.js"
import { serveFile } from "../file-service/index.js"

const BROWSER_SELF_EXECUTE_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browser-explorer-server/browser-self-execute-template.js"
const BROWSER_SELF_EXECUTE_STATIC_DATA_SPECIFIER = "BROWSER_SELF_EXECUTE_STATIC_DATA.js"

export const WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME = "/.jsenv-well-known/browser-self-execute.js"

export const serveBrowserSelfExecute = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

  if (ressource !== WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME) return null

  const filenameRelative = ressource.slice(1)

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSER_SELF_EXECUTE_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      [BROWSER_SELF_EXECUTE_STATIC_DATA_SPECIFIER]: () =>
        generateBrowserSelfExecuteStaticDataSource({ filenameRelative }),
    },
    headers,
    format: "iife",
  })
}

const generateBrowserSelfExecuteStaticDataSource = () =>
  `export const WELL_KNOWN_SYSTEM_PATHNAME = ${uneval(WELL_KNOWN_SYSTEM_PATHNAME)}
  export const WELL_KNOWN_BROWSER_PLATFORM_PATHNAME = ${uneval(
    WELL_KNOWN_BROWSER_PLATFORM_PATHNAME,
  )}
  export const WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME = ${uneval(
    WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME,
  )}`
