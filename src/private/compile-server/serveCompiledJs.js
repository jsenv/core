import { readFile } from "fs"
import { resolveFileUrl, fileUrlToPath, fileUrlToRelativePath } from "../urlUtils.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./js-compilation-service/transformResultToCompilationResult.js"
import { serveCompiledFile } from "./serveCompiledFile.js"

const { ressourceToContentType, defaultContentTypeMap } = import.meta.require("@dmail/server")

export const serveCompiledJs = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource } = request

  const relativePath = ressource.slice(1)

  // it's an asset, it will be served by fileService
  if (relativePathIsAsset(relativePath)) return null

  const compileDirectoryRelativePath = fileUrlToRelativePath(
    compileDirectoryUrl,
    projectDirectoryUrl,
  ).slice(2)

  const { compileId, fileRelativePath } = locateProject({
    compileDirectoryRelativePath,
    ressource,
  })

  // cannot locate a file -> we don't know what to compile
  // -> will be handled by fileService
  if (!compileId) return null

  // unexpected compileId
  if (compileId in groupMap === false) {
    return {
      status: 400,
      statusText: "unknown compileId",
    }
  }

  // json, css, html etc does not need to be compiled
  // they are redirected to the source location that will be served as file
  const contentType = ressourceToContentType(fileRelativePath, defaultContentTypeMap)
  if (contentType !== "application/javascript") {
    return {
      status: 307,
      headers: {
        location: resolveFileUrl(fileRelativePath, origin),
      },
    }
  }

  const relativePathToProjectDirectory = fileRelativePath
  const relativePathToCompileDirectory = `./${compileId}${fileRelativePath}`

  return serveCompiledFile({
    projectDirectoryUrl,
    compileDirectoryUrl,
    relativePathToProjectDirectory,
    relativePathToCompileDirectory,
    projectFileRequestedCallback,
    request,
    compile: async () => {
      const groupBabelPluginMap = {}
      groupMap[compileId].babelPluginRequiredNameArray.forEach((babelPluginRequiredName) => {
        if (babelPluginRequiredName in babelPluginMap) {
          groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName]
        }
      })

      const sourceUrl = resolveFileUrl(relativePathToProjectDirectory, projectDirectoryUrl)
      const sourceFilePath = fileUrlToPath(sourceUrl)
      const sourceBuffer = await new Promise((resolve, reject) => {
        readFile(sourceFilePath, (error, buffer) => {
          if (error) {
            reject(error)
          } else {
            resolve(buffer)
          }
        })
      })
      const source = String(sourceBuffer)

      const transformResult = await transformJs({
        projectDirectoryUrl,
        code: source,
        url: sourceUrl,
        babelPluginMap: groupBabelPluginMap,
        convertMap,
        transformTopLevelAwait,
      })
      return transformResultToCompilationResult(transformResult, {
        source,
        sourceUrl,
        projectDirectoryUrl,
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

const locateProject = ({ compileCacheDirectoryRelativePath, ressource }) => {
  if (ressource.startsWith(compileCacheDirectoryRelativePath) === false) {
    return {
      compileId: null,
      fileRelativePath: null,
    }
  }

  const afterCompileFolder = ressource.slice(compileCacheDirectoryRelativePath.length)
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
    fileRelativePath: remaining,
  }
}
