import { readFile } from "fs"
import { urlToContentType } from "@jsenv/server"
import { resolveFileUrl, pathToFileUrl, fileUrlToRelativePath } from "internal/urlUtils.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./js-compilation-service/transformResultToCompilationResult.js"
import { serveCompiledFile } from "./serveCompiledFile.js"

export const serveCompiledJs = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
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
  )

  // not inside compile directory -> nothing to compile
  if (relativePath.startsWith(compileDirectoryRelativePath) === false) return null

  const afterCompileDirectory = relativePath.slice(compileDirectoryRelativePath.length)
  const parts = afterCompileDirectory.split("/")

  const compileId = parts[0]
  // no compileId, we don't know what to compile (not supposed so happen)
  if (compileId === "") return null

  // unexpected compileId
  if (compileId in groupMap === false) {
    return {
      status: 400,
      statusText: `compileId must be one of ${Object.keys(groupMap)}, received ${compileId}`,
    }
  }

  const remaining = parts.slice(1).join("/")
  // nothing after compileId, we don't know what to compile (not suppoed to happen)
  if (remaining === "") return null

  const originalFileRelativePath = remaining

  // json, css, html etc does not need to be compiled
  // they are redirected to the source location that will be served as file
  const contentType = urlToContentType(pathToFileUrl(relativePath))
  if (contentType !== "application/javascript") {
    return {
      status: 307,
      headers: {
        location: resolveFileUrl(originalFileRelativePath, origin),
      },
    }
  }

  const compiledFileRelativePath = `${compileDirectoryRelativePath}${compileId}/${remaining}`

  return serveCompiledFile({
    projectDirectoryUrl,
    originalFileRelativePath,
    compiledFileRelativePath,
    projectFileRequestedCallback,
    request,
    compile: async ({ originalFilePath }) => {
      const groupBabelPluginMap = {}
      groupMap[compileId].babelPluginRequiredNameArray.forEach((babelPluginRequiredName) => {
        if (babelPluginRequiredName in babelPluginMap) {
          groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName]
        }
      })

      const originalFileUrl = pathToFileUrl(originalFilePath)
      const originalFileBuffer = await new Promise((resolve, reject) => {
        readFile(originalFilePath, (error, buffer) => {
          if (error) {
            reject(error)
          } else {
            resolve(buffer)
          }
        })
      })
      const originalFileContent = String(originalFileBuffer)

      const transformResult = await transformJs({
        projectDirectoryUrl,
        code: originalFileContent,
        url: originalFileUrl,
        babelPluginMap: groupBabelPluginMap,
        convertMap,
        transformTopLevelAwait,
        transformModuleIntoSystemFormat,
      })
      return transformResultToCompilationResult(transformResult, {
        source: originalFileContent,
        sourceUrl: originalFileUrl,
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
