import { uneval } from "@dmail/uneval"
import { serveBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { WELL_KNOWN_SYSTEM_PATHNAME } from "../compile-server/system-service/index.js"
import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"
import { WELL_KNOWN_SELF_IMPORT_DYNAMIC_DATA_PATHNAME } from "./serve-self-import-dynamic-data.js"
import { serveFile } from "../file-service/index.js"

const SELF_IMPORT_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browsing-server/self-import-template.js"
const SELF_IMPORT_STATIC_DATA_SPECIFIER = "SELF_IMPORT_STATIC_DATA.js"

export const WELL_KNOWN_SELF_IMPORT_PATHNAME = "/.jsenv-well-known/self-import.js"

export const serveSelfImport = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  babelConfigMap,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${WELL_KNOWN_SELF_IMPORT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

  if (ressource !== WELL_KNOWN_SELF_IMPORT_PATHNAME) return null

  const filenameRelative = ressource.slice(1)

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: SELF_IMPORT_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      [SELF_IMPORT_STATIC_DATA_SPECIFIER]: () =>
        generateSelfImportStaticDataSource({ filenameRelative }),
    },
    headers,
    format: "iife",
  })
}

const generateSelfImportStaticDataSource = () =>
  `export const WELL_KNOWN_SYSTEM_PATHNAME = ${uneval(WELL_KNOWN_SYSTEM_PATHNAME)}
  export const WELL_KNOWN_BROWSER_PLATFORM_PATHNAME = ${uneval(
    WELL_KNOWN_BROWSER_PLATFORM_PATHNAME,
  )}
  export const WELL_KNOWN_SELF_IMPORT_DYNAMIC_DATA_PATHNAME = ${uneval(
    WELL_KNOWN_SELF_IMPORT_DYNAMIC_DATA_PATHNAME,
  )}`
