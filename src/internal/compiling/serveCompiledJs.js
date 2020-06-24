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
import { compileHtml } from "./compileHtml.js"

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

  // serve files inside /.jsenv/out/* directly without compilation
  // this is just to allow some files to be written inside outDirectory and read directly
  // if asked by the client (such as env.json, groupMap.json, meta.json)
  if (!afterOutDirectory.includes("/") || afterOutDirectory[0] === "/") {
    return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
      method,
      headers,
    })
  }

  const parts = afterOutDirectory.split("/")
  const compileId = parts[0]
  const remaining = parts.slice(1).join("/")
  const contentType = urlToContentType(requestUrl)
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
    if (
      compileId === COMPILE_ID_GLOBAL_BUNDLE_FILES ||
      compileId === COMPILE_ID_COMMONJS_BUNDLE_FILES
    ) {
      const otherwiseImportmapFileUrl = resolveUrl(
        originalFileRelativeUrl,
        `${projectDirectoryUrl}${outDirectoryRelativeUrl}otherwise/`,
      )
      // for otherwise-commonjs-bundle, server did not write importMap.json
      // let's just return otherwise/importMapFileRelativeUrl
      return serveFile(otherwiseImportmapFileUrl, { method, headers })
    }
    return serveFile(compiledFileUrl, { method, headers })
  }

  if (contentType === "application/javascript") {
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
        const transformResult = await transformJs({
          projectDirectoryUrl,
          code,
          url: originalFileUrl,
          urlAfterTransform: compiledFileUrl,
          babelPluginMap: compileIdToBabelPluginMap(compileId, { groupMap, babelPluginMap }),
          convertMap,
          transformTopLevelAwait,
          transformModuleIntoSystemFormat: compileIdIsForBundleFiles(compileId)
            ? // we are compiling for rollup, do not transform into systemjs format
              false
            : transformModuleIntoSystemFormat,
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

  if (contentType === "text/html") {
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

      compile: () => compileHtml(originalFileUrl, { compiledFileUrl }),
    })
  }

  // json, css etc does not need to be compiled, they are redirected to their source version that will be served as file
  return {
    status: 307,
    headers: {
      location: resolveUrl(originalFileRelativeUrl, origin),
    },
  }
}

const compileIdIsForBundleFiles = (compileId) => {
  return (
    compileId === COMPILE_ID_GLOBAL_BUNDLE_FILES || compileId === COMPILE_ID_COMMONJS_BUNDLE_FILES
  )
}

const getWorstCompileId = (groupMap) => {
  if (COMPILE_ID_OTHERWISE in groupMap) {
    return COMPILE_ID_OTHERWISE
  }
  return Object.keys(groupMap)[Object.keys(groupMap).length - 1]
}

const compileIdToBabelPluginMap = (compileId, { babelPluginMap, groupMap }) => {
  let compiledIdForGroupMap
  let babelPluginMapForGroupMap
  if (compileIdIsForBundleFiles(compileId)) {
    compiledIdForGroupMap = getWorstCompileId(groupMap)
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

  return {
    ...groupBabelPluginMap,
    ...babelPluginMapForGroupMap,
  }
}
