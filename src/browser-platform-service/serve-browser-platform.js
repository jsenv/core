import { uneval } from "@dmail/uneval"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveBundle } from "../bundle-service/index.js"

const IMPORT_MAP_SPECIFIER = "IMPORT_MAP.json"
const WELL_KNOWN_BROWSER_PLATFORM_PATHNAME = `/.jsenv-well-known/browser-platform.js`
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
  ressource,
  headers,
}) => {
  if (ressource !== WELL_KNOWN_BROWSER_PLATFORM_PATHNAME) return null

  const browserGroupResolverFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserGroupResolverFilenameRelative,
  })

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: WELL_KNOWN_BROWSER_PLATFORM_PATHNAME.slice(1),
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: "node_modules/@jsenv/core/src/browser-platform/index.js",
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
