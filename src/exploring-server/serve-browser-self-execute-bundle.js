import { basename } from "path"
import { serveFile } from "@dmail/server"
import { serveBundle } from "../bundle-service/serve-bundle.js"
import { ressourceToPathname, ressourceToSearchParamValue } from "../urlHelper.js"

const BROWSER_SELF_EXECUTE_CLIENT_PATHNAME = "/.jsenv/browser-self-execute.js"
const BROWSER_SELF_EXECUTE_STATIC_DATA_PATHNAME = "/.jsenv/browser-self-execute-static-data.js"

export const serveBrowserSelfExecuteBundle = async ({
  projectPathname,
  importMapRelativePath,
  compileIntoRelativePath,
  browserSelfExecuteTemplateRelativePath,
  babelPluginMap,
  request: { ressource, method, headers },
  livereloading,
}) => {
  if (ressource.startsWith(`/.jsenv/browser-self-execute/`)) {
    const assetRelativePath = ressource.slice("/.jsenv/browser-self-execute/".length)
    return serveFile(`${projectPathname}${compileIntoRelativePath}${assetRelativePath}`, {
      method,
      headers,
    })
  }

  const pathname = ressourceToPathname(ressource)
  const file = ressourceToSearchParamValue(ressource, "file")
  const fileRelativePath = `/${file}`

  if (pathname !== BROWSER_SELF_EXECUTE_CLIENT_PATHNAME) return null

  return serveBundle({
    format: "global",
    projectPathname,
    compileIntoRelativePath,
    importMapRelativePath,
    sourceRelativePath: browserSelfExecuteTemplateRelativePath,
    compileRelativePath: `/.jsenv/browser-self-execute${fileRelativePath}`,
    sourcemapPath: `./browser-self-execute${fileRelativePath}__asset__/${basename(
      fileRelativePath,
    )}.map`,
    specifierDynamicMap: {
      [BROWSER_SELF_EXECUTE_STATIC_DATA_PATHNAME]: () =>
        generateBrowserSelfExecuteStaticDataSource({ fileRelativePath, livereloading }),
    },
    headers,
    babelPluginMap,
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({ fileRelativePath, livereloading }) =>
  `export const fileRelativePath = ${JSON.stringify(fileRelativePath)}
export const livereloading = ${JSON.stringify(livereloading)}`
