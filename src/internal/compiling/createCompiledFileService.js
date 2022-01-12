import { fetchUrl, fetchFileSystem } from "@jsenv/server"
import {
  resolveUrl,
  resolveDirectoryUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
  urlToOrigin,
  urlToPathname,
  writeFile,
} from "@jsenv/filesystem"

import { createRuntimeCompat } from "@jsenv/core/src/internal/generateGroupMap/runtime_compat.js"
import { shakeBabelPluginMap } from "@jsenv/core/src/internal/generateGroupMap/shake_babel_plugin_map.js"
import { serverUrlToCompileInfo } from "@jsenv/core/src/internal/url_conversion.js"

import { originAsDirectoryName } from "./origin_as_directory_name.js"
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
  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  prependSystemJs,
  groupMap,
  customCompilers,
  workerUrls,
  serviceWorkerUrls,
  importMapInWebWorkers,

  jsenvEventSourceClientInjection,
  jsenvToolbarInjection,

  projectFileRequestedCallback,
  compileCacheStrategy,
  sourcemapMethod,
  sourcemapExcludeSources,
}) => {
  const compileIdModuleFormats = {}
  Object.keys(groupMap).forEach((groupName) => {
    compileIdModuleFormats[groupName] = canAvoidSystemJs({
      runtimeSupport: groupMap[groupName].minRuntimeVersions,
      workerUrls,
      importMapInWebWorkers,
    })
      ? "esmodule"
      : "systemjs"
  })

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

  return async (request, { pushResponse, redirectRequest }) => {
    const { origin, ressource } = request
    const requestUrl = `${origin}${ressource}`

    const requestCompileInfo = serverUrlToCompileInfo(requestUrl, {
      outDirectoryRelativeUrl,
      compileServerOrigin: origin,
    })

    // not inside compile directory -> nothing to compile
    if (!requestCompileInfo.insideCompileDirectory) {
      return null
    }

    const { compileId, afterCompileId } = requestCompileInfo
    // serve files inside /.jsenv/* directly without compilation
    // this is just to allow some files to be written inside outDirectory and read directly
    // if asked by the client (such __compile_server_meta__.json)
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

    // ici
    const urlObject = new URL(requestUrl)
    const { search } = urlObject
    const searchParams = new URLSearchParams(search)
    const externalUrl = searchParams.get("external_url")
    let originalFileRelativeUrl
    let originalFileUrl
    let responseHeaders
    if (externalUrl) {
      // TODO: forward response headers + handle cache
      const requestHeadersToForward = {
        ...request.headers,
      }
      delete requestHeadersToForward.host
      const response = await fetchUrl(externalUrl, {
        mode: "cors",
        headers: requestHeadersToForward,
      })
      const { status } = response
      if (status !== 200) {
        throw new Error(`not 200`)
      }
      responseHeaders = Object.fromEntries(response.headers.entries())
      delete responseHeaders["connection"]
      delete responseHeaders["keep-alive"]
      delete responseHeaders["cache-control"]
      delete responseHeaders["content-length"]
      delete responseHeaders["content-type"]
      delete responseHeaders["content-encoding"]
      const responseBodyAsArrayBuffer = await response.arrayBuffer()
      const responseBodyAsBuffer = Buffer.from(responseBodyAsArrayBuffer)
      const directoryName = originAsDirectoryName(urlToOrigin(requestUrl))
      originalFileRelativeUrl = `${outDirectoryRelativeUrl}external/${directoryName}${urlToPathname(
        requestUrl,
      )}`
      originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
      await writeFile(originalFileUrl, responseBodyAsBuffer)
    } else {
      originalFileRelativeUrl = afterCompileId
      originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`
    }
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
      originalFileUrl,
      compiledFileUrl,

      compileCacheStrategy,
      projectFileRequestedCallback,
      request,
      pushResponse,
      importmapInfos,
      compile: ({ code }) => {
        return compiler({
          logger,

          code,
          url: originalFileUrl,
          compiledUrl: compiledFileUrl,
          projectDirectoryUrl,
          compileServerOrigin: request.origin,
          outDirectoryRelativeUrl,
          compileId,
          request,
          babelPluginMap: shakeBabelPluginMap({
            babelPluginMap,
            missingFeatureNames: groupMap[compileId].missingFeatureNames,
          }),
          runtimeSupport,
          workerUrls,
          serviceWorkerUrls,
          moduleOutFormat:
            moduleOutFormat === undefined
              ? compileIdModuleFormats[compileId]
              : moduleOutFormat,
          importMetaFormat,
          topLevelAwait,
          prependSystemJs,

          sourcemapMethod,
          sourcemapExcludeSources,
          jsenvEventSourceClientInjection,
          jsenvToolbarInjection,
          onHtmlImportmapInfo: ({ htmlUrl, importmapInfo }) => {
            importmapInfos[htmlUrl] = importmapInfo
          },
        })
      },
    })
    return compileResponsePromise
  }
}

const canAvoidSystemJs = ({
  runtimeSupport,
  workerUrls,
  importMapInWebWorkers,
}) => {
  const runtimeCompatMap = createRuntimeCompat({
    featureNames: [
      "module",
      "importmap",
      "import_assertion_type_json",
      "import_assertion_type_css",
      ...(workerUrls.length > 0 ? ["worker_type_module"] : []),
      ...(importMapInWebWorkers ? ["worker_importmap"] : []),
    ],
    runtimeSupport,
  })
  return runtimeCompatMap.missingFeatureNames.length === 0
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
