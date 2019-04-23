import { uneval } from "@dmail/uneval"
import { filenameRelativeInception } from "../../filenameRelativeInception.js"
import { serveBundle } from "../../bundle-service/index.js"

const IMPORT_MAP_SPECIFIER = "IMPORT_MAP.json"
const WELL_KNOWN_BROWSER_CLIENT_PATHNAME = `/.jsenv-well-known/browser-client.js`
const BROWSER_CLIENT_DATA_SPECIFIER = "BROWSER_CLIENT_DATA.js"
const BROWSER_GROUP_RESOLVER_SPECIFIER = "BROWSER_GROUP_RESOLVER.js"

export const serveBrowserClient = async ({
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
  if (ressource !== WELL_KNOWN_BROWSER_CLIENT_PATHNAME) return null

  const browserGroupResolverFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: browserGroupResolverFilenameRelative,
  })

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: WELL_KNOWN_BROWSER_CLIENT_PATHNAME.slice(1),
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: "node_modules/@jsenv/core/src/browser-client/index.js",
    }),
    inlineSpecifierMap: {
      [IMPORT_MAP_SPECIFIER]: `${projectFolder}/${importMapFilenameRelative}`,
      [BROWSER_GROUP_RESOLVER_SPECIFIER]: `${projectFolder}/${browserGroupResolverFilenameRelativeInception}`,
      [BROWSER_CLIENT_DATA_SPECIFIER]: () => generateBrowserClientDataSource({ groupMap }),
    },
    ressource,
    headers,
  })
}

const generateBrowserClientDataSource = ({ groupMap }) =>
  `export const groupMap = ${uneval(groupMap)}`
