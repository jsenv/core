import { uneval } from "@dmail/uneval"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveBundle } from "../bundle-service/index.js"

const IMPORT_MAP_SPECIFIER = "IMPORT_MAP.json"
export const JSENV_NODE_PLATFORM_PATHNAME = `/.jsenv/node-platform.js`
const NODE_PLATFORM_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/node-platform-service/node-platform/index.js"
const NODE_PLATFORM_DATA_SPECIFIER = "NODE_PLATFORM_DATA.js"
const NODE_GROUP_RESOLVER_SPECIFIER = "NODE_GROUP_RESOLVER.js"

export const serveNodePlatform = ({
  projectFolder,
  importMapFilenameRelative,
  nodeGroupResolverFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  // projectFileRequestedCallback,
  request: { ressource, headers },
}) => {
  if (ressource !== JSENV_NODE_PLATFORM_PATHNAME) return null

  const nodeGroupResolverFilenameRelativeInception = filenameRelativeInception({
    projectFolder,
    filenameRelative: nodeGroupResolverFilenameRelative,
  })

  return serveBundle({
    projectFolder,
    importMapFilenameRelative,
    compileInto,
    babelConfigMap,
    filenameRelative: JSENV_NODE_PLATFORM_PATHNAME.slice(1),
    sourceFilenameRelative: filenameRelativeInception({
      projectFolder,
      filenameRelative: NODE_PLATFORM_FILENAME_RELATIVE,
    }),
    inlineSpecifierMap: {
      [IMPORT_MAP_SPECIFIER]: `${projectFolder}/${importMapFilenameRelative}`,
      [NODE_GROUP_RESOLVER_SPECIFIER]: `${projectFolder}/${nodeGroupResolverFilenameRelativeInception}`,
      [NODE_PLATFORM_DATA_SPECIFIER]: () => generateNodePlatformDataSource({ groupMap }),
    },
    headers,
    format: "cjs",
  })
}

const generateNodePlatformDataSource = ({ groupMap }) =>
  `export const groupMap = ${uneval(groupMap)}`
