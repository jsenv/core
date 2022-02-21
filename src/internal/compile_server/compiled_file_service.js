import { fetchFileSystem, urlToContentType } from "@jsenv/server"

import {
  resolveUrl,
  resolveDirectoryUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"

import { injectHmr } from "@jsenv/core/src/internal/autoreload/hmr_injection.js"
import { redirectorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"
import { serverUrlToCompileInfo } from "@jsenv/core/src/internal/url_conversion.js"
import { injectQuery } from "../url_utils.js"

import { inferCompilationAssetFromUrl } from "./jsenv_directory/compile_asset.js"
import { compileFile } from "./compile_file.js"

export const createCompiledFileService = ({
  compileServerOperation,
  logger,

  projectDirectoryUrl,
  ressourceGraph,
  sourceFileFetcher,
  jsenvFileSelector,
  jsenvDirectoryRelativeUrl,
  jsenvDirectory,

  customCompilers,
  jsenvCompilers,
  hmrPlugins,

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
    const sourceFileRelativeUrl = afterCompileId
    const sourceFileUrl = `${projectDirectoryUrl}${sourceFileRelativeUrl}`
    const compiler = getCompiler({
      sourceFileUrl,
      customCompilerMeta,
      jsenvCompilers,
    })
    // no compiler
    if (!compiler) {
      const compilationAsset = inferCompilationAssetFromUrl(requestUrl)
      if (compilationAsset) {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), projectDirectoryUrl),
          {
            headers: request.headers,
            etagEnabled: true,
          },
        )
      }
      // -> serve original file
      // we redirect "internally" (we dont send 304 to the browser)
      // to keep ressource tracking and url resolution simple
      return redirectRequest({
        pathname: `/${sourceFileRelativeUrl}`,
      })
    }
    const hmr = new URL(sourceFileUrl).searchParams.get("hmr")
    const handleResponse = async (response) => {
      if (!hmr) {
        return response
      }
      const responseBodyAsString = response.body
      const contentType = response.headers["content-type"]
      const body = await injectHmr({
        projectDirectoryUrl,
        ressourceGraph,
        sourceFileFetcher,
        hmrPlugins,
        url: sourceFileUrl,
        contentType,
        moduleFormat: compileProfile.moduleOutFormat,
        content: responseBodyAsString,
      })
      return {
        status: 200,
        headers: {
          ...response.headers,
          "content-length": Buffer.byteLength(body),
          "cache-control": "no-store", // not really needed thanks to the query param
        },
        body,
        timing: response.timing,
      }
    }

    const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const compiledFileUrl = resolveUrl(
      sourceFileRelativeUrl,
      compileDirectoryUrl,
    )
    const response = await compileFile({
      compileServerOperation,
      logger,

      projectDirectoryUrl,
      sourceFileFetcher,
      jsenvDirectory,
      sourceFileUrl,
      compiledFileUrl,

      request,
      pushResponse,

      compileCacheStrategy,
      compile: ({ content }) => {
        return compiler({
          logger,

          projectDirectoryUrl,
          ressourceGraph,
          sourceFileFetcher,
          jsenvFileSelector,
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
    return handleResponse(response)
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
