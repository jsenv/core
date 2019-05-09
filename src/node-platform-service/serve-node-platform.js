import { uneval } from "@dmail/uneval"
import { serveFile } from "../file-service/index.js"
import { filenameRelativeInception } from "../filenameRelativeInception.js"
import { serveBundle } from "../bundle-service/index.js"

const NODE_PLATFORM_FILENAME_RELATIVE =
  "node_modules/@jsenv/core/src/node-platform-service/node-platform/index.js"

const JSENV_NODE_PLATFORM_PATHNAME = `/.jsenv/node-platform.js`
const JSENV_NODE_PLATFORM_DATA_PATHNAME = `/.jsenv/node-platform-data.js`
const JSENV_NODE_GROUP_RESOLVER_PATHNAME = `/.jsenv/node-group-resolver.js`
const JSENV_IMPORT_MAP_PATHNAME = `/.jsenv/import-map.json`

export const serveNodePlatform = ({
  projectFolder,
  importMapFilenameRelative,
  nodeGroupResolverFilenameRelative,
  compileInto,
  babelConfigMap,
  groupMap,
  // projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${JSENV_NODE_PLATFORM_PATHNAME}__asset__/`)) {
    return serveFile(`${projectFolder}/${compileInto}${ressource}`, { method, headers })
  }

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
      [JSENV_NODE_PLATFORM_DATA_PATHNAME]: () =>
        generateNodePlatformDataSource({ compileInto, groupMap }),
      [JSENV_NODE_GROUP_RESOLVER_PATHNAME]: `${projectFolder}/${nodeGroupResolverFilenameRelativeInception}`,
      [JSENV_IMPORT_MAP_PATHNAME]: `${projectFolder}/${importMapFilenameRelative}`,
    },
    headers,
    format: "cjs",
  })
}

const generateNodePlatformDataSource = ({ compileInto, groupMap }) =>
  `export const compileInto = ${uneval(compileInto)}
export const groupMap = ${uneval(groupMap)}`
