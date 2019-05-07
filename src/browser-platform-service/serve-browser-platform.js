import { uneval } from "@dmail/uneval"
import { serveFile } from "../file-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveBundle } from "../bundle-service/index.js"

const BROWSER_PLATFORM_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browser-platform-service/browser-platform/index.js"

const JSENV_BROWSER_PLATFORM_PATHNAME = `/.jsenv/browser-platform.js`
const JSENV_BROWSER_PLATFORM_DATA_PATHNAME = `/.jsenv/browser-platform-data.js`
const JSENV_BROWSER_GROUP_RESOLVER_PATHNAME = `/.jsenv/browser-group-resolver.js`
const JSENV_IMPORT_MAP_PATHNAME = `/.jsenv/import-map.json`

export const serveBrowserPlatform = async ({
  projectFolder,
  importMapFilenameRelative,
  browserGroupResolverFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  // projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${JSENV_BROWSER_PLATFORM_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }
  if (ressource !== JSENV_BROWSER_PLATFORM_PATHNAME) return null

  const browserGroupResolverFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserGroupResolverFilenameRelative,
  })

  const filenameRelative = ressource.slice(1)

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative,
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: BROWSER_PLATFORM_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      [JSENV_BROWSER_PLATFORM_DATA_PATHNAME]: () =>
        generateBrowserPlatformDataSource({ compileInto, groupMap }),
      [JSENV_BROWSER_GROUP_RESOLVER_PATHNAME]: `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`,
      [JSENV_IMPORT_MAP_PATHNAME]: `${projectFolder}/${importMapFilenameRelative}`,
    },
    headers,
    format: "iife",
  })
}

const generateBrowserPlatformDataSource = ({ compileInto, groupMap }) =>
  `export const compileInto = ${uneval(compileInto)}
export const groupMap = ${uneval(groupMap)}`
