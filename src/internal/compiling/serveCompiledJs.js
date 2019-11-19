import { urlToContentType } from "@jsenv/server"
import { urlToRelativeUrl, resolveFileUrl, fileUrlToPath } from "internal/urlUtils.js"
import { readFileContent } from "internal/filesystemUtils.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./js-compilation-service/transformResultToCompilationResult.js"
import { serveCompiledFile } from "./serveCompiledFile.js"
import { urlIsAsset } from "./urlIsAsset.js"

export const serveCompiledJs = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  importReplaceMap,
  importFallbackMap,
  writeOnFilesystem,
  useFilesystemAsCache,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  projectFileRequestedCallback,
  request,
}) => {
  const { origin, ressource } = request
  const requestUrl = `${origin}${ressource}`
  // it's an asset, it will be served by fileService
  if (urlIsAsset(requestUrl)) {
    return null
  }

  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const compileDirectoryServerUrl = `${origin}/${compileDirectoryRelativeUrl}`
  // not inside compile directory -> nothing to compile
  if (!requestUrl.startsWith(compileDirectoryServerUrl)) {
    return null
  }

  const afterCompileDirectory = requestUrl.slice(compileDirectoryServerUrl.length)
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

  const originalFileRelativeUrl = remaining

  // json, css, html etc does not need to be compiled
  // they are redirected to the source location that will be served as file
  const contentType = urlToContentType(requestUrl)
  if (contentType !== "application/javascript") {
    return {
      status: 307,
      headers: {
        location: resolveFileUrl(originalFileRelativeUrl, origin),
      },
    }
  }

  const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
  const originalFileServerUrl = `${origin}/${originalFileRelativeUrl}`
  if (originalFileServerUrl in importReplaceMap) {
    // disable cache if the file is ignored anyway
    // and a function is used instead
    useFilesystemAsCache = false
  }

  const compiledFileUrl = `${compileDirectoryUrl}${compileId}/${originalFileRelativeUrl}`

  return serveCompiledFile({
    projectDirectoryUrl,
    importReplaceMap,
    importFallbackMap,
    originalFileUrl,
    compiledFileUrl,
    writeOnFilesystem,
    useFilesystemAsCache,
    projectFileRequestedCallback,
    request,
    compile: async () => {
      let code
      if (originalFileServerUrl in importReplaceMap) {
        code = await importReplaceMap[originalFileServerUrl]()
      } else if (originalFileServerUrl in importFallbackMap) {
        try {
          code = await readFileContent(fileUrlToPath(originalFileUrl))
        } catch (e) {
          if (e.code === "ENOENT") {
            code = await importFallbackMap[originalFileServerUrl]()
          } else {
            throw e
          }
        }
      } else {
        code = await readFileContent(fileUrlToPath(originalFileUrl))
      }

      const groupBabelPluginMap = {}
      groupMap[compileId].babelPluginRequiredNameArray.forEach((babelPluginRequiredName) => {
        if (babelPluginRequiredName in babelPluginMap) {
          groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName]
        }
      })

      const transformResult = await transformJs({
        projectDirectoryUrl,
        code,
        url: originalFileUrl,
        babelPluginMap: groupBabelPluginMap,
        convertMap,
        transformTopLevelAwait,
        transformModuleIntoSystemFormat,
      })

      const sourcemapFileUrl = `${compiledFileUrl}.map`

      return transformResultToCompilationResult(transformResult, {
        projectDirectoryUrl,
        originalFileContent: code,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
      })
    },
  })
}
