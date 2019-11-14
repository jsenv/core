import { basename } from "path"
import { serveFile, ressourceToPathname, ressourceToSearchParamValue } from "@dmail/server"
import { exploringServerProjectPathname } from "./exploring-server-project.js"

// use import.meta.require to avoid breaking jsenvRelativePathInception
const { serveBundle } = import.meta.require("@jsenv/compile-server")

const BROWSER_SELF_EXECUTE_CLIENT_PATHNAME = "/.jsenv/browser-self-execute.js"

export const serveBrowserSelfExecuteBundle = async ({
  projectPathname,
  importMapRelativePath,
  importDefaultExtension,
  compileIntoRelativePath,
  browserSelfExecuteTemplateRelativePath,
  babelPluginMap,
  request,
  livereloading,
  logger,
}) => {
  const { ressource, method, headers } = request

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

  const compileRelativePath = `/.jsenv/browser-self-execute${fileRelativePath}`
  const sourcemapRelativePath = `${compileRelativePath}__asset__/${basename(fileRelativePath)}.map`

  return serveBundle({
    format: "global",
    projectPathname,
    jsenvProjectPathname: exploringServerProjectPathname,
    compileIntoRelativePath,
    sourceRelativePath: browserSelfExecuteTemplateRelativePath,
    compileRelativePath,
    sourcemapRelativePath,
    importDefaultExtension,
    importMapRelativePath,
    specifierAbstractMap: {
      "/.jsenv/browser-self-execute-static-data.js": () =>
        generateBrowserSelfExecuteStaticDataSource({ fileRelativePath, livereloading }),
    },
    request,
    babelPluginMap,
    logger,
  })
}

const generateBrowserSelfExecuteStaticDataSource = ({ fileRelativePath, livereloading }) =>
  `export const fileRelativePath = ${JSON.stringify(fileRelativePath)}
export const livereloading = ${JSON.stringify(livereloading)}`
