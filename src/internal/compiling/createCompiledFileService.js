import { serveFile } from "@jsenv/server"
import {
  resolveUrl,
  resolveDirectoryUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

import { serverUrlToCompileInfo } from "@jsenv/core/src/internal/url_conversion.js"
import {
  COMPILE_ID_BUILD_GLOBAL,
  COMPILE_ID_BUILD_GLOBAL_FILES,
  COMPILE_ID_BUILD_COMMONJS,
  COMPILE_ID_BUILD_COMMONJS_FILES,
} from "../CONSTANTS.js"
import { compileFile } from "./compileFile.js"
import { compileHtml } from "./jsenvCompilerForHtml.js"
import { compileImportmap } from "./jsenvCompilerForImportmap.js"
import { compileJavascript } from "./jsenvCompilerForJavaScript.js"

const jsenvCompilers = {
  "**/*.js": compileJavascript,
  "**/*.jsx": compileJavascript,
  "**/*.ts": compileJavascript,
  "**/*.tsx": compileJavascript,
  "**/*.mjs": compileJavascript,

  "**/*.html": compileHtml,
  "**/*.importmap": compileImportmap,
}

export const createCompiledFileService = ({
  sourceFileService,
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,

  runtimeSupport,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  babelPluginMap,
  groupMap,
  // convertMap,
  customCompilers,

  jsenvToolbarInjection,

  projectFileRequestedCallback,
  useFilesystemAsCache,
  compileCacheStrategy,
  sourcemapExcludeSources,
}) => {
  const compilerCandidates = {
    ...jsenvCompilers,
    ...customCompilers,
  }
  Object.keys(compilerCandidates).forEach((key) => {
    const value = compilerCandidates[key]
    if (typeof value !== "function") {
      throw new TypeError(
        `A compiler must be a function, found ${value} for "${key}"`,
      )
    }
  })
  const compileStructuredMetaMap = normalizeStructuredMetaMap(
    {
      compile: compilerCandidates,
    },
    projectDirectoryUrl,
  )

  return (request) => {
    const { origin, ressource } = request
    const requestUrl = `${origin}${ressource}`

    const requestCompileInfo = serverUrlToCompileInfo(requestUrl, {
      outDirectoryRelativeUrl,
      compileServerOrigin: origin,
    })

    // not inside compile directory -> nothing to compile
    if (!requestCompileInfo.insideCompileDirectory) {
      return sourceFileService(request)
    }

    const { compileId, afterCompileId } = requestCompileInfo
    // serve files inside /.jsenv/out/* directly without compilation
    // this is just to allow some files to be written inside outDirectory and read directly
    // if asked by the client (such as env.json, groupMap.json, meta.json)
    if (!compileId) {
      return serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true,
      })
    }

    const allowedCompileIds = [
      ...Object.keys(groupMap),
      COMPILE_ID_BUILD_GLOBAL,
      COMPILE_ID_BUILD_GLOBAL_FILES,
      COMPILE_ID_BUILD_COMMONJS,
      COMPILE_ID_BUILD_COMMONJS_FILES,
    ]
    if (!allowedCompileIds.includes(compileId)) {
      return {
        status: 400,
        statusText: `compileId must be one of ${allowedCompileIds}, received ${compileId}`,
      }
    }

    // nothing after compileId, we don't know what to compile (not supposed to happen)
    if (afterCompileId === "") {
      return sourceFileService(request)
    }

    const originalFileRelativeUrl = afterCompileId
    projectFileRequestedCallback(originalFileRelativeUrl, request)

    const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
    const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const compiledFileUrl = resolveUrl(
      originalFileRelativeUrl,
      compileDirectoryUrl,
    )
    const { compile } = urlToMeta({
      url: originalFileUrl,
      structuredMetaMap: compileStructuredMetaMap,
    })

    // no compiler -> serve original file
    // we don't redirect otherwise it complexify ressource tracking
    // and url resolution
    if (!compile) {
      return sourceFileService({
        ...request,
        ressource: `/${originalFileRelativeUrl}`,
      })
    }

    // compile this if needed
    const compileResponsePromise = compileFile({
      cancellationToken,
      logger,

      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,

      writeOnFilesystem: true, // we always need them
      useFilesystemAsCache,
      compileCacheStrategy,
      projectFileRequestedCallback,
      request,
      compile: ({ code, map }) => {
        return compile({
          cancellationToken,
          logger,

          code,
          map,
          url: originalFileUrl,
          compiledUrl: compiledFileUrl,
          projectDirectoryUrl,
          compileServerOrigin: request.origin,
          outDirectoryRelativeUrl,
          compileId,

          runtimeSupport,
          moduleOutFormat,
          importMetaFormat,
          transformTopLevelAwait,
          babelPluginMap: compileIdToBabelPluginMap(compileId, {
            babelPluginMap,
            groupMap,
          }),

          sourcemapMethod: "comment", // "inline" is also possible
          sourcemapExcludeSources,
          jsenvToolbarInjection,
        })
      },
    })
    return compileResponsePromise
  }
}

const compileIdToBabelPluginMap = (compileId, { babelPluginMap, groupMap }) => {
  const babelPluginMapForGroupMap = {}

  const groupBabelPluginMap = {}
  groupMap[compileId].babelPluginRequiredNameArray.forEach(
    (babelPluginRequiredName) => {
      if (babelPluginRequiredName in babelPluginMap) {
        groupBabelPluginMap[babelPluginRequiredName] =
          babelPluginMap[babelPluginRequiredName]
      }
    },
  )

  return {
    ...groupBabelPluginMap,
    ...babelPluginMapForGroupMap,
  }
}
