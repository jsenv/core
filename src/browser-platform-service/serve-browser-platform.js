import { serveFile } from "@dmail/server"
import { serveBundle } from "../bundle-service/serve-bundle.js"

const BROWSER_PLATFORM_CLIENT_PATHNAME = `/.jsenv/browser-platform.js`
const BROWSER_PLATFORM_DATA_CLIENT_PATHNAME = `/.jsenv/browser-platform-data.js`
const IMPORT_MAP_CLIENT_PATHNAME = `/.jsenv/import-map.json`

export const serveBrowserPlatform = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  browserPlatformRelativePath,
  babelPluginMap,
  groupMap,
  projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${BROWSER_PLATFORM_CLIENT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }
  if (ressource !== BROWSER_PLATFORM_CLIENT_PATHNAME) return null

  return serveBundle({
    format: "global",
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    importDefaultExtension,
    compileRelativePath: ressource,
    sourceRelativePath: browserPlatformRelativePath,
    specifierMap: {
      [IMPORT_MAP_CLIENT_PATHNAME]: `file://${projectPathname}${importMapRelativePath}`,
    },
    specifierDynamicMap: {
      [BROWSER_PLATFORM_DATA_CLIENT_PATHNAME]: () =>
        generateBrowserPlatformDataSource({
          compileIntoRelativePath,
          groupMap,
          importDefaultExtension,
        }),
    },
    projectFileRequestedCallback,
    babelPluginMap,
    headers,
  })
}

const generateBrowserPlatformDataSource = ({
  compileIntoRelativePath,
  groupMap,
  importDefaultExtension,
}) =>
  `export const compileIntoRelativePath = ${JSON.stringify(compileIntoRelativePath)}
export const groupMap = ${JSON.stringify(groupMap)}
export const importDefaultExtension = ${JSON.stringify(importDefaultExtension)}`
