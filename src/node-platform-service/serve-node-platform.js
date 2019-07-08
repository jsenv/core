import { serveFile } from "@dmail/server"
import { serveBundle } from "../bundling/index.js"
import { readProjectImportMap } from "../import-map/readProjectImportMap.js"
import { relativePathInception } from "../JSENV_PATH.js"

const NODE_PLATFORM_CLIENT_PATHNAME = `/.jsenv/node-platform.js`
const NODE_PLATFORM_DATA_CLIENT_PATHNAME = `/.jsenv/node-platform-data.js`
const NODE_GROUP_RESOLVER_CLIENT_PATHNAME = `/.jsenv/node-group-resolver.js`
const IMPORT_MAP_CLIENT_PATHNAME = `/.jsenv/import-map.json`

export const serveNodePlatform = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  nodePlatformRelativePath,
  nodeGroupResolverRelativePath,
  babelPluginMap,
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

  const importMap = await readProjectImportMap({ projectPathname, importMapRelativePath })

  nodePlatformRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: nodePlatformRelativePath,
  })
  nodeGroupResolverRelativePath = relativePathInception({
    projectPathname,
    importMap,
    relativePath: nodeGroupResolverRelativePath,
  })

  return serveBundle({
    format: "commonjs",
    projectPathname,
    compileIntoRelativePath,
    sourceRelativePath: nodePlatformRelativePath,
    compileRelativePath: NODE_PLATFORM_CLIENT_PATHNAME,
    importMap,
    specifierMap: {
      [NODE_GROUP_RESOLVER_CLIENT_PATHNAME]: nodeGroupResolverRelativePath,
      [IMPORT_MAP_CLIENT_PATHNAME]: `file://${projectPathname}${importMapRelativePath}`,
    },
    specifierDynamicMap: {
      [NODE_PLATFORM_DATA_CLIENT_PATHNAME]: () =>
        generateNodePlatformDataSource({
          compileIntoRelativePath,
          groupMap,
          importDefaultExtension,
        }),
    },
    babelPluginMap,
    headers,
  })
}

const generateNodePlatformDataSource = ({
  compileIntoRelativePath,
  groupMap,
  importDefaultExtension,
}) =>
  `export const compileIntoRelativePath = ${JSON.stringify(compileIntoRelativePath)}
export const groupMap = ${JSON.stringify(groupMap)}
export const importDefaultExtension = ${JSON.stringify(importDefaultExtension)}`
