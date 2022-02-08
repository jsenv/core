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

export const createCompiledFileService = ({
  compileServerOperation,
  logger,

  projectDirectoryUrl,
  jsenvFileSelector,
  jsenvDirectoryRelativeUrl,
  jsenvDirectory,
  jsenvRemoteDirectory,
  ressourceGraph,

  customCompilers,
  jsenvCompilers,

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
  const customCompilerMeta = normalizeStructuredMetaMap(
    {
      customCompiler: customCompilers,
    },
    projectDirectoryUrl,
  )
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

    if (urlIsCompilationAsset(requestUrl)) {
      return fetchFileSystem(
        new URL(request.ressource.slice(1), projectDirectoryUrl),
        {
          headers: request.headers,
          etagEnabled: true,
        },
      )
    }

    const sourceFileRelativeUrl = afterCompileId
    const sourceFileUrl = `${projectDirectoryUrl}${sourceFileRelativeUrl}`
    const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const compiledFileUrl = resolveUrl(
      sourceFileRelativeUrl,
      compileDirectoryUrl,
    )
    const compiler = getCompiler({
      sourceFileUrl,
      customCompilerMeta,
      jsenvCompilers,
    })
    // no compiler -> serve original file
    // we redirect "internally" (we dont send 304 to the browser)
    // to keep ressource tracking and url resolution simple
    if (!compiler) {
      return redirectRequest({
        pathname: `/${sourceFileRelativeUrl}`,
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
      sourceFileUrl,
      compiledFileUrl,

      request,
      pushResponse,

      compileProfile,
      compileCacheStrategy,
      compile: ({ content }) => {
        return compiler({
          logger,

          projectDirectoryUrl,
          ressourceGraph,
          jsenvFileSelector,
          jsenvRemoteDirectory,
          jsenvDirectoryRelativeUrl,
          url: sourceFileUrl,
          compiledUrl: compiledFileUrl,
          request,

          compileProfile,
          compileId,

          sourcemapMethod,
          sourcemapExcludeSources,
          content,
        })
      },
    })
    return compileResponsePromise
  }
}

const getCompiler = ({ sourceFileUrl, customCompilerMeta, jsenvCompilers }) => {
  // we remove eventual query param from the url
  // Without this a pattern like "**/*.js" would not match "file.js?t=1"
  // This would result in file not being compiled when they should
  // Ideally we would do a first pass with the query param and a second without
  const urlObject = new URL(sourceFileUrl)
  urlObject.search = ""
  sourceFileUrl = urlObject.href
  const { customCompiler } = urlToMeta({
    url: sourceFileUrl,
    structuredMetaMap: customCompilerMeta,
  })
  if (!customCompiler) {
    const contentType = urlToContentType(sourceFileUrl)
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
      map: customCompilerReturnValue.sourcemap,
      content: customCompilerReturnValue.content,
    })
    return {
      ...customCompilerReturnValue,
      ...jsenvCompilerReturnValue,
    }
  }
}
