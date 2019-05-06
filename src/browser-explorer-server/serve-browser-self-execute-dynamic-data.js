import { uneval } from "@dmail/uneval"
import { serveCompiledFile } from "../compiled-file-service/index.js"
import { compileJs } from "../compiled-js-service/index.js"

export const WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME =
  "/.jsenv-well-known/browser-self-execute-dynamic-data.js"

export const serveBrowserSelfExecuteDynamicData = ({
  projectFolder,
  compileInto,
  babelConfigMap,
  compileServerOrigin,
  request: { ressource, headers },
}) => {
  if (ressource !== WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME) return null

  const filenameRelative = ressource.slice(1)

  return serveCompiledFile({
    projectFolder,
    sourceFilenameRelative: filenameRelative,
    compiledFilenameRelative: `${compileInto}/${filenameRelative}`,
    headers,
    compile: async () => {
      const source = generateDynamicDataSource({ compileInto, compileServerOrigin })

      return compileJs({
        projectFolder,
        babelConfigMap,
        filenameRelative,
        filename: `${projectFolder}/${filenameRelative}`,
        outputFilename: `file://${projectFolder}/${compileInto}/${filenameRelative}`,
        source,
      })
    },
    clientCompileCacheStrategy: "none",
  })
}

const generateDynamicDataSource = ({
  compileInto,
  compileServerOrigin,
}) => `export const compileInto = ${uneval(compileInto)}
  export const compileServerOrigin = ${uneval(compileServerOrigin)}`
