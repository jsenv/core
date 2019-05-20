import { fileRead } from "@dmail/helper"
import { compileJs } from "./compileJs.js"
import { serveCompiledFile } from "../compiled-file-service/index.js"

export const serveCompiledJs = async ({
  projectPathname,
  compileIntoRelativePath,
  groupMap,
  babelPluginMap,
  transformTopLevelAwait,
  projectFileRequestedCallback,
  request: { origin, ressource, headers },
}) => {
  // it's an asset, it will be served by fileService
  if (relativePathIsAsset(ressource)) return null

  const { compileId, fileRelativePath } = locateProject({
    compileIntoRelativePath,
    ressource,
  })

  // cannot locate a file -> we don't know what to compile
  // -> will be handled by fileService
  if (!compileId) return null

  // unexpected compileId
  if (compileId in groupMap === false) return { status: 400, statusText: "unknown compileId" }

  // .json does not need to be compiled, they are redirected
  // to the source location, that will be handled by fileService
  if (fileRelativePath.endsWith(".json")) {
    return {
      status: 307,
      headers: {
        location: `${origin}${fileRelativePath}`,
      },
    }
  }

  projectFileRequestedCallback({
    fileRelativePath,
  })

  const sourceRelativePath = fileRelativePath
  const compileRelativePath = `${compileIntoRelativePath}/${compileId}${fileRelativePath}`

  return serveCompiledFile({
    projectPathname,
    sourceRelativePath,
    compileRelativePath,
    headers,
    compile: async ({ sourceFilename }) => {
      const source = await fileRead(sourceFilename)
      const groupbabelPluginMap = {}
      groupMap[compileId].incompatibleNameArray.forEach((incompatibleFeatureName) => {
        if (incompatibleFeatureName in babelPluginMap) {
          groupbabelPluginMap[incompatibleFeatureName] = babelPluginMap[incompatibleFeatureName]
        }
      })

      return compileJs({
        source,
        projectPathname,
        sourceRelativePath,
        compileRelativePath,
        babelPluginMap: groupbabelPluginMap,
        transformTopLevelAwait,
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
// that day pathnameRelativeIsAsset must be this:
// => pathnameRelative.startsWith(`${compileInto}/__assets__/`)
// I don't do it for now because it will impact sourcemap paths
// and sourceMappingURL comment at the bottom of compiled files
// and that's something sensitive
export const relativePathIsAsset = (relativePath) => relativePath.match(/[^\/]+__asset__\/.+$/)

const locateProject = ({ compileIntoRelativePath, ressource }) => {
  if (ressource.startsWith(`${compileIntoRelativePath}/`) === false) {
    return {
      compileId: null,
      fileRelativePath: null,
    }
  }

  const afterCompileFolder = ressource.slice(`${compileIntoRelativePath}/`.length)
  const parts = afterCompileFolder.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      fileRelativePath: null,
    }
  }

  const remaining = parts.slice(1).join("/")
  if (remaining.length === 0) {
    return {
      compileId: null,
      fileRelativePath: "",
    }
  }

  return {
    compileId,
    fileRelativePath: `/${remaining}`,
  }
}
