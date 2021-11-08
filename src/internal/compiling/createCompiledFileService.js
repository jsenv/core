import { nextService, fetchFileSystem } from "@jsenv/server"
import {
  resolveUrl,
  resolveDirectoryUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

import { serverUrlToCompileInfo } from "@jsenv/core/src/internal/url_conversion.js"
import { setUrlExtension } from "../url_utils.js"
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
  compileServerOperation,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,

  runtimeSupport,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  babelPluginMap,
  groupMap,
  customCompilers,

  jsenvToolbarInjection,

  projectFileRequestedCallback,
  useFilesystemAsCache,
  compileCacheStrategy,
  sourcemapMethod,
  sourcemapExcludeSources,
}) => {
  Object.keys(customCompilers).forEach((key) => {
    const value = customCompilers[key]
    if (typeof value !== "function") {
      throw new TypeError(
        `Compiler must be a function, found ${value} for "${key}"`,
      )
    }
  })
  const compileMeta = normalizeStructuredMetaMap(
    {
      jsenvCompiler: jsenvCompilers,
      customCompiler: customCompilers,
    },
    projectDirectoryUrl,
  )

  return (request) => {
    const { origin, ressource } = request
    const requestUrl = `${origin}${ressourceToPathname(ressource)}`

    const requestCompileInfo = serverUrlToCompileInfo(requestUrl, {
      outDirectoryRelativeUrl,
      compileServerOrigin: origin,
    })

    // not inside compile directory -> nothing to compile
    if (!requestCompileInfo.insideCompileDirectory) {
      return null
    }

    const { compileId, afterCompileId } = requestCompileInfo
    // serve files inside /.jsenv/out/* directly without compilation
    // this is just to allow some files to be written inside outDirectory and read directly
    // if asked by the client (such as env.json, groupMap.json, meta.json)
    if (!compileId) {
      return fetchFileSystem(
        new URL(request.ressource.slice(1), projectDirectoryUrl),
        {
          headers: request.headers,
          etagEnabled: true,
        },
      )
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
      return null
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

    const compiler = getCompiler({ originalFileUrl, compileMeta })
    // no compiler -> serve original file
    // we don't redirect otherwise it complexify ressource tracking
    // and url resolution
    if (!compiler) {
      return nextService({
        ...request,
        ressource: `/${originalFileRelativeUrl}`,
      })
    }

    // compile this if needed
    const compileResponsePromise = compileFile({
      compileServerOperation,
      logger,

      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,

      writeOnFilesystem: true, // we always need them
      useFilesystemAsCache,
      compileCacheStrategy,
      projectFileRequestedCallback,
      request,
      compile: ({ signal, code, map }) => {
        return compiler({
          signal,
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
          babelPluginMap: babelPluginMapFromCompileId(compileId, {
            babelPluginMap,
            groupMap,
          }),

          sourcemapMethod,
          sourcemapExcludeSources,
          jsenvToolbarInjection,
        })
      },
    })
    return compileResponsePromise
  }
}

const getCompiler = ({ originalFileUrl, compileMeta }) => {
  const { jsenvCompiler, customCompiler } = urlToMeta({
    url: originalFileUrl,
    structuredMetaMap: compileMeta,
  })

  if (!jsenvCompiler && !customCompiler) {
    return null
  }

  // there is only a jsenvCompiler
  if (jsenvCompiler && !customCompiler) {
    return jsenvCompiler
  }

  // there is a custom compiler and potentially a jsenv compiler
  return async (params) => {
    // do custom compilation first
    const customResult = await customCompiler(params)
    // then check if jsenv compiler should apply
    // to the new result contentType
    const jsenvCompilerAfterCustomCompilation =
      getJsenvCompilerAfterCustomCompilation({
        url: originalFileUrl,
        contentType: customResult.contentType,
        compileMeta,
      })
    if (!jsenvCompilerAfterCustomCompilation) {
      return customResult
    }
    const jsenvResult = await jsenvCompilerAfterCustomCompilation({
      ...params,
      code: customResult.compiledSource,
      map: customResult.sourcemap,
    })
    return jsenvResult
  }
}

const getJsenvCompilerAfterCustomCompilation = ({
  url,
  contentType,
  compileMeta,
}) => {
  const extensionToForce = contentTypeExtensions[contentType]
  const urlForcingExtension = extensionToForce
    ? setUrlExtension(url, extensionToForce)
    : url
  const { jsenvCompiler } = urlToMeta({
    url: urlForcingExtension,
    structuredMetaMap: compileMeta,
  })
  return jsenvCompiler
}

// should match contentType where there is a jsenv compiler
// back to an extension
const contentTypeExtensions = {
  "application/javascript": ".js",
  "text/html": ".html",
  "application/importmap+json": ".importmap",
  // "text/css": ".css",
}

const babelPluginMapFromCompileId = (
  compileId,
  { babelPluginMap, groupMap },
) => {
  const babelPluginMapForGroup = {}

  groupMap[compileId].pluginRequiredNameArray.forEach((requiredPluginName) => {
    const babelPlugin = babelPluginMap[requiredPluginName]
    if (babelPlugin) {
      babelPluginMapForGroup[requiredPluginName] = babelPlugin
    }
  })

  Object.keys(babelPluginMap).forEach((key) => {
    if (key.startsWith("syntax-")) {
      babelPluginMapForGroup[key] = babelPluginMap[key]
    }
    if (key === "transform-replace-expressions") {
      babelPluginMapForGroup[key] = babelPluginMap[key]
    }
  })

  return babelPluginMapForGroup
}

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?")
  const pathname =
    searchSeparatorIndex === -1
      ? ressource
      : ressource.slice(0, searchSeparatorIndex)
  return pathname
}
