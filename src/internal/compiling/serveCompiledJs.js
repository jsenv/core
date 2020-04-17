import { urlToContentType, serveFile } from "@jsenv/server"
import { resolveUrl, resolveDirectoryUrl, readFile } from "@jsenv/util"
import {
  COMPILE_ID_OTHERWISE,
  COMPILE_ID_GLOBAL_BUNDLE,
  COMPILE_ID_GLOBAL_BUNDLE_FILES,
  COMPILE_ID_COMMONJS_BUNDLE,
  COMPILE_ID_COMMONJS_BUNDLE_FILES,
} from "../CONSTANTS.js"
import { createBabePluginMapForBundle } from "../bundling/createBabePluginMapForBundle.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./js-compilation-service/transformResultToCompilationResult.js"
import { serveCompiledFile } from "./serveCompiledFile.js"
import { serveBundle } from "./serveBundle.js"

export const serveCompiledJs = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerImportMap,
  importMapFileRelativeUrl,
  importDefaultExtension,

  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  babelPluginMap,
  groupMap,
  convertMap,

  request,
  projectFileRequestedCallback,
  useFilesystemAsCache,
  writeOnFilesystem,
  compileCacheStrategy,
}) => {
  const { origin, ressource, method, headers } = request
  const requestUrl = `${origin}${ressource}`
  const outDirectoryRemoteUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, origin)
  // not inside compile directory -> nothing to compile
  if (!requestUrl.startsWith(outDirectoryRemoteUrl)) {
    return null
  }

  const afterOutDirectory = requestUrl.slice(outDirectoryRemoteUrl.length)

  // serve files inside /.dist/* directly without compilation
  // this is just to allow some files to be written inside .dist and read directly
  // if asked by the client
  if (!afterOutDirectory.includes("/") || afterOutDirectory[0] === "/") {
    return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
      method,
      headers,
    })
  }

  const parts = afterOutDirectory.split("/")
  const compileId = parts[0]
  // no compileId, we don't know what to compile (not supposed so happen)
  if (compileId === "") {
    return null
  }

  const allowedCompileIds = [
    ...Object.keys(groupMap),
    COMPILE_ID_GLOBAL_BUNDLE,
    COMPILE_ID_GLOBAL_BUNDLE_FILES,
    COMPILE_ID_COMMONJS_BUNDLE,
    COMPILE_ID_COMMONJS_BUNDLE_FILES,
  ]

  if (!allowedCompileIds.includes(compileId)) {
    return {
      status: 400,
      statusText: `compileId must be one of ${allowedCompileIds}, received ${compileId}`,
    }
  }

  const remaining = parts.slice(1).join("/")
  // nothing after compileId, we don't know what to compile (not supposed to happen)
  if (remaining === "") {
    return null
  }

  const originalFileRelativeUrl = remaining
  const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`
  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  const compiledFileUrl = resolveUrl(originalFileRelativeUrl, compileDirectoryUrl)

  // send out/best/importMap.json untouched
  if (originalFileRelativeUrl === importMapFileRelativeUrl) {
    return serveFile(compiledFileUrl, { method, headers })
  }

  // json, css, html etc does not need to be compiled
  // they are redirected to the source location that will be served as file
  // ptet qu'on devrait pas parce que
  // on pourrait vouloir minifier ce résultat (mais bon ça osef disons)
  // par contre on voudrait ptet avoir le bon concept
  // (quon a dans transformResultToCompilationResult)
  // pour tracker la bonne source avec le bon etag
  // sinon on track le export default
  // mais ça ça vient plutot du bundle
  // qui doit gérer content/contentRaw
  const contentType = urlToContentType(requestUrl)
  if (contentType !== "application/javascript") {
    return {
      status: 307,
      headers: {
        location: resolveUrl(originalFileRelativeUrl, origin),
      },
    }
  }

  if (compileId === COMPILE_ID_GLOBAL_BUNDLE || compileId === COMPILE_ID_COMMONJS_BUNDLE) {
    return serveBundle({
      cancellationToken,
      logger,

      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin: request.origin,
      compileServerImportMap,
      importDefaultExtension,

      babelPluginMap,
      projectFileRequestedCallback,
      request,
      format: compileId === COMPILE_ID_GLOBAL_BUNDLE ? "global" : "commonjs",
    })
  }

  return serveCompiledFile({
    cancellationToken,
    logger,

    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,

    writeOnFilesystem,
    useFilesystemAsCache,
    compileCacheStrategy,
    projectFileRequestedCallback,
    request,
    compile: async () => {
      const code = await readFile(originalFileUrl)

      let compiledIdForGroupMap
      let babelPluginMapForGroupMap
      if (
        compileId === COMPILE_ID_GLOBAL_BUNDLE_FILES ||
        compileId === COMPILE_ID_COMMONJS_BUNDLE_FILES
      ) {
        compiledIdForGroupMap = getWorstCompileId(groupMap)
        // we are compiling for rollup, do not transform into systemjs format
        transformModuleIntoSystemFormat = false
        babelPluginMapForGroupMap = createBabePluginMapForBundle({
          format: compileId === COMPILE_ID_GLOBAL_BUNDLE_FILES ? "global" : "commonjs",
        })
      } else {
        compiledIdForGroupMap = compileId
        babelPluginMapForGroupMap = {}
      }

      const groupBabelPluginMap = {}
      groupMap[compiledIdForGroupMap].babelPluginRequiredNameArray.forEach(
        (babelPluginRequiredName) => {
          if (babelPluginRequiredName in babelPluginMap) {
            groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName]
          }
        },
      )

      const transformResult = await transformJs({
        projectDirectoryUrl,
        code,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: {
          ...groupBabelPluginMap,
          ...babelPluginMapForGroupMap,
        },
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
        remapMethod: writeOnFilesystem ? "comment" : "inline",
      })
    },
  })
}

const getWorstCompileId = (groupMap) => {
  if (COMPILE_ID_OTHERWISE in groupMap) {
    return COMPILE_ID_OTHERWISE
  }
  return Object.keys(groupMap)[Object.keys(groupMap).length - 1]
}
