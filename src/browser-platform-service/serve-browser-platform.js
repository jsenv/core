import { uneval } from "@dmail/uneval"
import { serveFile } from "../file-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveBundle } from "../bundle-service/index.js"

const IMPORT_MAP_SPECIFIER = "IMPORT_MAP.json"
export const WELL_KNOWN_BROWSER_PLATFORM_PATHNAME = `/.jsenv-well-known/browser-platform.js`
const BROWSER_PLATFORM_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/browser-platform-service/browser-platform/index.js"
const BROWSER_PLATFORM_DATA_SPECIFIER = "BROWSER_PLATFORM_DATA.js"
const BROWSER_GROUP_RESOLVER_SPECIFIER = "BROWSER_GROUP_RESOLVER.js"

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
  if (ressource.startsWith(`${WELL_KNOWN_BROWSER_PLATFORM_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }
  if (ressource !== WELL_KNOWN_BROWSER_PLATFORM_PATHNAME) return null

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
      [IMPORT_MAP_SPECIFIER]: `${projectFolder}/${importMapFilenameRelative}`,
      [BROWSER_GROUP_RESOLVER_SPECIFIER]: `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`,
      [BROWSER_PLATFORM_DATA_SPECIFIER]: () => generateBrowserPlatformDataSource({ groupMap }),
    },
    headers,
  })
}

const generateBrowserPlatformDataSource = ({ groupMap }) =>
  `export const groupMap = ${uneval(groupMap)}`
