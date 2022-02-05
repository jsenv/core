import { fetchFileSystem } from "@jsenv/server"
import {
  resolveUrl,
  resolveDirectoryUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

import { redirectorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"
import { serverUrlToCompileInfo } from "@jsenv/core/src/internal/url_conversion.js"
import { setUrlExtension } from "../url_utils.js"

import { compileFile } from "./compile_file.js"
import { compileHtml } from "./html/compile_html.js"
import { compileImportmap } from "./importmap/compile_importmap.js"
import { compileJavascript } from "./js/compile_js.js"

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
  jsenvFileSelector,
  jsenvDirectoryRelativeUrl,
  jsenvDirectory,
  jsenvRemoteDirectory,
  ressourceGraph,

  babelPluginMap,
  topLevelAwait,
  prependSystemJs,
  customCompilers,

  compileCacheStrategy,
  sourcemapMethod,
  sourcemapExcludeSources,

  inlineImportMapIntoHTML,
  eventSourceClient,
  browserClient,
  toolbar,
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
  const importmapInfos = {}
  const redirectorFile = jsenvFileSelector.select(redirectorFiles, {
    canUseScriptTypeModule: false,
  })

  return async (request, { pushResponse, redirectRequest }) => {
    const { origin, ressource } = request
    const requestUrl = `${origin}${ressource}`
    const requestCompileInfo = serverUrlToCompileInfo(requestUrl, {
      compileServerOrigin: origin,
      jsenvDirectoryRelativeUrl,
    })
    // not inside compile directory -> nothing to compile
    if (!requestCompileInfo.insideCompileDirectory) {
      return null
    }
    const { compileId, afterCompileId } = requestCompileInfo
    // serve files inside /.jsenv/* directly without compilation
    // this is just to allow some files to be written inside outDirectory and read directly
    // if asked by the client
    if (!compileId) {
      return fetchFileSystem(
        new URL(request.ressource.slice(1), projectDirectoryUrl),
        {
          headers: request.headers,
          etagEnabled: true,
        },
      )
    }
    const compileDirectory = jsenvDirectory.compileDirectories[compileId]
    if (!compileDirectory) {
      return {
        status: 307,
        headers: {
          location: `${request.origin}${
            redirectorFile.urlRelativeToProject
          }?redirect=${encodeURIComponent(afterCompileId)}`,
        },
      }
    }
    // nothing after compileId, we don't know what to compile (not supposed to happen)
    if (afterCompileId === "") {
      return null
    }
    const { compileProfile } = compileDirectory
    const originalFileRelativeUrl = afterCompileId
    const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
    const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`
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
    // we redirect "internally" (we dont send 304 to the browser)
    // to keep ressource tracking and url resolution simple
    if (!compiler) {
      return redirectRequest({
        pathname: `/${originalFileRelativeUrl}`,
      })
    }
    // compile this if needed
    const compileResponsePromise = compileFile({
      compileServerOperation,
      logger,

      projectDirectoryUrl,
      jsenvDirectory,
      jsenvRemoteDirectory,
      ressourceGraph,
      originalFileUrl,
      compiledFileUrl,
      importmapInfos,

      request,
      pushResponse,

      compileProfile,
      compileCacheStrategy,
      compile: ({ code }) => {
        return compiler({
          logger,

          projectDirectoryUrl,
          jsenvFileSelector,
          jsenvRemoteDirectory,
          compileServerOrigin: request.origin,
          jsenvDirectoryRelativeUrl,
          url: originalFileUrl,
          compiledUrl: compiledFileUrl,
          ressourceGraph,
          request,

          compileProfile,
          compileId,
          babelPluginMap,
          topLevelAwait,
          prependSystemJs,

          code,
          sourcemapMethod,
          sourcemapExcludeSources,

          inlineImportMapIntoHTML,
          eventSourceClient,
          browserClient,
          toolbar,
          onHtmlImportmapInfo: ({ htmlUrl, importmapInfo }) => {
            importmapInfos[htmlUrl] = importmapInfo
          },
        })
      },
    })
    return compileResponsePromise
  }
}

const getCompiler = ({ originalFileUrl, compileMeta }) => {
  // we remove eventual query param from the url
  // Without this a pattern like "**/*.js" would not match "file.js?t=1"
  // This would result in file not being compiled when they should
  // Ideally we would do a first pass with the query param and a second without
  const urlObject = new URL(originalFileUrl)
  urlObject.search = ""
  originalFileUrl = urlObject.href

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
    const customCompilerReturnValue = await customCompiler(params)
    // then check if jsenv compiler should apply
    // to the new result contentType
    const jsenvCompilerAfterCustomCompilation =
      getJsenvCompilerAfterCustomCompilation({
        url: originalFileUrl,
        compileMeta,
        customCompilerReturnValue,
      })
    if (!jsenvCompilerAfterCustomCompilation) {
      return customCompilerReturnValue
    }
    const jsenvCompilerReturnValue = await jsenvCompilerAfterCustomCompilation({
      ...params,
      code: customCompilerReturnValue.compiledSource,
      map: customCompilerReturnValue.sourcemap,
    })
    return {
      ...customCompilerReturnValue,
      ...jsenvCompilerReturnValue,
    }
  }
}

const getJsenvCompilerAfterCustomCompilation = ({
  url,
  compileMeta,
  customCompilerReturnValue,
}) => {
  if (customCompilerReturnValue.isBuild) {
    return null
  }
  const extensionToForce =
    contentTypeExtensions[customCompilerReturnValue.contentType]
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
