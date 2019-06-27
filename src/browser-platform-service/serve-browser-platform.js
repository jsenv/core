import { serveFile } from "@dmail/server"
import { relativePathInception } from "../inception.js"
import { serveBrowserGlobalBundle } from "../bundling/index.js"

export const BROWSER_PLATFORM_RELATIVE_PATH =
  "/src/browser-platform-service/browser-platform/index.js"
const BROWSER_PLATFORM_CLIENT_PATHNAME = `/.jsenv/browser-platform.js`
const BROWSER_PLATFORM_DATA_CLIENT_PATHNAME = `/.jsenv/browser-platform-data.js`
const BROWSER_GROUP_RESOLVER_CLIENT_PATHNAME = `/.jsenv/browser-group-resolver.js`
const IMPORT_MAP_CLIENT_PATHNAME = `/.jsenv/import-map.json`

export const serveBrowserPlatform = async ({
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  browserGroupResolverRelativePath,
  babelPluginMap,
  groupMap,
  // projectFileRequestedCallback,
  request: { ressource, method, headers },
}) => {
  if (ressource.startsWith(`${BROWSER_PLATFORM_CLIENT_PATHNAME}__asset__/`)) {
    return serveFile(`${projectPathname}${compileIntoRelativePath}${ressource}`, {
      method,
      headers,
    })
  }
  if (ressource !== BROWSER_PLATFORM_CLIENT_PATHNAME) return null

  return serveBrowserGlobalBundle({
    projectPathname,
    importMapRelativePath,
    compileIntoRelativePath,
    babelPluginMap,
    compileRelativePath: ressource,
    sourceRelativePath: relativePathInception({
      projectPathname,
      relativePath: BROWSER_PLATFORM_RELATIVE_PATH,
    }),
    inlineSpecifierMap: {
      [BROWSER_PLATFORM_DATA_CLIENT_PATHNAME]: () =>
        generateBrowserPlatformDataSource({ compileIntoRelativePath, groupMap }),
      [BROWSER_GROUP_RESOLVER_CLIENT_PATHNAME]: `${projectPathname}${relativePathInception({
        projectPathname,
        relativePath: browserGroupResolverRelativePath,
      })}`,
      [IMPORT_MAP_CLIENT_PATHNAME]: `${projectPathname}${importMapRelativePath}`,
    },
    headers,
  })
}

const generateBrowserPlatformDataSource = ({ compileIntoRelativePath, groupMap }) =>
  `export const compileIntoRelativePath = ${JSON.stringify(compileIntoRelativePath)}
export const groupMap = ${JSON.stringify(groupMap)}`
