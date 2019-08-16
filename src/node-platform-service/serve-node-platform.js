import { serveFile } from "@dmail/server"
import { serveBundle } from "../bundle-service/serve-bundle.js"

const NODE_PLATFORM_CLIENT_PATHNAME = `/.jsenv/node-platform.js`
const NODE_PLATFORM_DATA_CLIENT_PATHNAME = `/.jsenv/node-platform-data.js`
const IMPORT_MAP_CLIENT_PATHNAME = `/.jsenv/import-map.json`

export const serveNodePlatform = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  nodePlatformRelativePath,
  babelPluginMap,
  groupMap,
  projectFileRequestedCallback,
  request,
}) => {
  const { ressource, method, headers } = request

  if (ressource.startsWith(`${NODE_PLATFORM_CLIENT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }

  if (ressource !== NODE_PLATFORM_CLIENT_PATHNAME) return null

  return serveBundle({
    format: "commonjs",
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    importDefaultExtension,
    sourceRelativePath: nodePlatformRelativePath,
    compileRelativePath: NODE_PLATFORM_CLIENT_PATHNAME,
    specifierMap: {
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
    projectFileRequestedCallback,
    babelPluginMap,
    request,
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
