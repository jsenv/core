import { fileRead } from "@dmail/helper"
import { compileJs } from "./compileJs.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"

export const serveCompiledJs = async ({
  projectFolder,
  compileInto,
  groupMap,
  babelConfigMap,
  transformTopLevelAwait,
  projectFileRequestedCallback,
  origin,
  ressource,
  headers,
}) => {
  // it's an asset, it will be served by fileService
  if (filenameRelativeIsAsset(ressource.slice(1))) return null

  const { compileId, filenameRelative } = locateProject({
    compileInto,
    ressource,
  })

  // cannot locate a file -> we don't know what to compile
  // -> will be handled by fileService
  if (!compileId) return null

  // unexpected compileId
  if (compileId in groupMap === false) return { status: 400, statusText: "unknown compileId" }

  // .json does not need to be compiled, they are redirected
  // to the source location, that will be handled by fileService
  if (filenameRelative.endsWith(".json")) {
    return {
      status: 307,
      headers: {
        location: `${origin}/${filenameRelative}`,
      },
    }
  }

  const sourceFilenameRelative = filenameRelative
  const compiledFilenameRelative = `${compileInto}/${compileId}/${filenameRelative}`

  projectFileRequestedCallback({
    filenameRelative: sourceFilenameRelative,
    filename: `${projectFolder}/${sourceFilenameRelative}`,
  })

  return serveCompiledFile({
    projectFolder,
    sourceFilenameRelative,
    compiledFilenameRelative,
    headers,
    compile: async ({ sourceFilename }) => {
      const source = await fileRead(sourceFilename)
      const groupBabelConfigMap = {}
      groupMap[compileId].incompatibleNameArray.forEach((incompatibleFeatureName) => {
        if (incompatibleFeatureName in babelConfigMap) {
          groupBabelConfigMap[incompatibleFeatureName] = babelConfigMap[incompatibleFeatureName]
        }
      })

      return compileJs({
        projectFolder,
        babelConfigMap: groupBabelConfigMap,
        transformTopLevelAwait,
        filenameRelative: sourceFilenameRelative,
        filename: sourceFilename,
        outputFilename: `file://${projectFolder}/${compileInto}/${compileId}/${filenameRelative}`,
        source,
      })
    },
  })
}

// in the future I may want to put assets in a separate directory like this:
//
// /dist
//   /__assets__
//     index.js.map
//     index.js.cache.json
//       /foo
//        bar.js.map
//        bar.js.cache.json
//   index.js
//   foo/
//     bar.js
//
// so that the dist folder is not polluted with the asset files
// that day filenameRelativeIsAsset must be this:
// => filenameRelative.startsWith(`${compileInto}/__assets__/`)
// I don't do it for now because it will impact sourcemap paths
// and sourceMappingURL comment at the bottom of compiled files
// and that's something sensitive
export const filenameRelativeIsAsset = (filenameRelative) =>
  filenameRelative.match(/[^\/]+__asset__\/.+$/)

const locateProject = ({ compileInto, ressource }) => {
  if (ressource.startsWith(`/${compileInto}/`) === false) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const afterCompileInto = ressource.slice(`/${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      filenameRelative: null,
    }
  }

  const filenameRelative = parts.slice(1).join("/")
  if (filenameRelative.length === 0) {
    return {
      compileId: null,
      filenameRelative: "",
    }
  }

  return {
    compileId,
    filenameRelative,
  }
}
