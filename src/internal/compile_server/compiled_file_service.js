import { fetchFileSystem, urlToContentType } from "@jsenv/server"
import {
  resolveUrl,
  resolveDirectoryUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

import { redirectorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"
import { serverUrlToCompileInfo } from "@jsenv/core/src/internal/url_conversion.js"
import { injectQuery } from "../url_utils.js"

import { compileFile } from "./compile_file.js"
import { compileHtml } from "./html/compile_html.js"
import { compileImportmap } from "./importmap/compile_importmap.js"
import { compileJavascript } from "./js/compile_js.js"

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
  htmlSupervisor,
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
  const customCompilerMeta = normalizeStructuredMetaMap(
    {
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
          location: injectQuery(
            `${request.origin}${redirectorFile.urlRelativeToProject}`,
            {
              redirect: afterCompileId,
            },
          ),
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
    const compiler = getCompiler({ originalFileUrl, customCompilerMeta })
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
          htmlSupervisor,
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

const getCompiler = ({ originalFileUrl, customCompilerMeta }) => {
  // we remove eventual query param from the url
  // Without this a pattern like "**/*.js" would not match "file.js?t=1"
  // This would result in file not being compiled when they should
  // Ideally we would do a first pass with the query param and a second without
  const urlObject = new URL(originalFileUrl)
  urlObject.search = ""
  originalFileUrl = urlObject.href
  const { customCompiler } = urlToMeta({
    url: originalFileUrl,
    structuredMetaMap: customCompilerMeta,
  })
  if (!customCompiler) {
    const contentType = urlToContentType(originalFileUrl)
    const jsenvCompiler = jsenvCompilers[contentType]
    return jsenvCompiler || null
  }
  return async (params) => {
    // do custom compilation first
    const customCompilerReturnValue = await customCompiler(params)
    const contentType = customCompilerReturnValue.contentType
    // check if there is a jsenv compiler for this contentType
    const jsenvCompiler = jsenvCompilers[contentType]
    if (!jsenvCompiler) {
      return customCompilerReturnValue
    }
    const jsenvCompilerReturnValue = await jsenvCompiler({
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

const jsenvCompilers = {
  "text/html": compileHtml,
  "application/importmap+json": compileImportmap,
  "application/javascript": compileJavascript,
}
