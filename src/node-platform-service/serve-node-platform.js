import { uneval } from "@dmail/uneval"
import { serveFile } from "../file-service/index.js"
import { relativePathInception } from "../inception.js"
import { serveBundle } from "../bundle-service/index.js"

const NODE_PLATFORM_RELATIVE_PATH = "/src/node-platform-service/node-platform/index.js"
const NODE_PLATFORM_CLIENT_PATHNAME = `/.jsenv/node-platform.js`
const NODE_PLATFORM_DATA_CLIENT_PATHNAME = `/.jsenv/node-platform-data.js`
const NODE_GROUP_RESOLVER_CLIENT_PATHNAME = `/.jsenv/node-group-resolver.js`
const IMPORT_MAP_CLIENT_PATHNAME = `/.jsenv/import-map.json`

export const serveNodePlatform = ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  nodeGroupResolverRelativePath,
  babelConfigMap,
  groupMap,
  // projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${NODE_PLATFORM_CLIENT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }

  if (ressource !== NODE_PLATFORM_CLIENT_PATHNAME) return null

  return serveBundle({
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    babelConfigMap,
    sourceRelativePath: relativePathInception({
      projectPathname,
      relativePath: NODE_PLATFORM_RELATIVE_PATH,
    }),
    compileRelativePath: NODE_PLATFORM_CLIENT_PATHNAME,
    inlineSpecifierMap: {
      [NODE_PLATFORM_DATA_CLIENT_PATHNAME]: () =>
        generateNodePlatformDataSource({ compileIntoRelativePath, groupMap }),
      [NODE_GROUP_RESOLVER_CLIENT_PATHNAME]: `${projectPathname}${relativePathInception({
        projectPathname,
        relativePath: nodeGroupResolverRelativePath,
      })}`,
      [IMPORT_MAP_CLIENT_PATHNAME]: `${projectPathname}${importMapRelativePath}`,
    },
    headers,
    format: "cjs",
  })
}

const generateNodePlatformDataSource = ({ compileIntoRelativePath, groupMap }) =>
  `export const compileIntoRelativePath = ${uneval(compileIntoRelativePath)}
export const groupMap = ${uneval(groupMap)}`
