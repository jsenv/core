/* eslint-disable import/max-dependencies */
import { urlToContentType, serveFile } from "@jsenv/server"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import {
  COMPILE_ID_OTHERWISE,
  COMPILE_ID_GLOBAL_BUNDLE,
  COMPILE_ID_GLOBAL_BUNDLE_FILES,
  COMPILE_ID_COMMONJS_BUNDLE,
  COMPILE_ID_COMMONJS_BUNDLE_FILES,
} from "../CONSTANTS.js"
import { jsenvToolbarHtmlFileUrl } from "../jsenvInternalFiles.js"
import { createBabePluginMapForBundle } from "../bundling/createBabePluginMapForBundle.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./js-compilation-service/transformResultToCompilationResult.js"
import { compileFile } from "./compileFile.js"
import { serveBundle } from "./serveBundle.js"
import { compileHtml } from "./compileHtml.js"
import { appendSourceMappingAsExternalUrl } from "../sourceMappingURLUtils.js"
import { generateCompiledFileAssetUrl } from "./compile-directory/compile-asset.js"

export const createCompiledFileService = ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  browserBundledJsFileRelativeUrl,
  compileServerImportMap,
  importMapFileRelativeUrl,
  importDefaultExtension,

  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  babelPluginMap,
  groupMap,
  convertMap,
  scriptManipulations,

  projectFileRequestedCallback,
  useFilesystemAsCache,
  writeOnFilesystem,
  compileCacheStrategy,
}) => {
  return (request) => {
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
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
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

      return compileFile({
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
        compile: async (originalFileContent) => {
          const transformResult = await transformJs({
            projectDirectoryUrl,
            code: originalFileContent,
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
            originalFileContent,
            originalFileUrl,
            compiledFileUrl,
            sourcemapFileUrl,
            remapMethod: writeOnFilesystem ? "comment" : "inline",
          })
        },
      })
    }

    if (contentType === "text/html") {
      return compileFile({
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

        compile: async (htmlBeforeCompilation) => {
          const { htmlAfterCompilation, scriptsExternalized } = compileHtml(htmlBeforeCompilation, {
            scriptManipulations: [
              {
                // when html file already contains an importmap script tag
                // its src is replaced to target the importmap used for compiled files
                replaceExisting: true,
                type: "importmap",
                src: `/${outDirectoryRelativeUrl}${compileId}/${importMapFileRelativeUrl}`,
              },
              {
                src: `/${browserBundledJsFileRelativeUrl}`,
              },
              // todo: this is dirty because it means
              // compile server is aware of exploring and jsenv toolbar
              // instead this should be moved to startExploring
              ...(originalFileUrl === jsenvToolbarHtmlFileUrl ? [] : scriptManipulations),
            ],
            generateInlineScriptSrc: ({ id, hash }) => {
              const scriptAssetUrl = generateCompiledFileAssetUrl(
                compiledFileUrl,
                id ? `${id}.js` : `${hash}.js`,
              )
              return `./${urlToRelativeUrl(scriptAssetUrl, compiledFileUrl)}`
            },
          })

          let assets = []
          let assetsContent = []
          await Promise.all(
            Object.keys(scriptsExternalized).map(async (scriptSrc) => {
              const scriptAssetUrl = resolveUrl(scriptSrc, compiledFileUrl)
              const scriptBasename = urlToRelativeUrl(scriptAssetUrl, compiledFileUrl)
              const scriptOriginalFileUrl = resolveUrl(scriptBasename, originalFileUrl)
              const scriptAfterTransformFileUrl = resolveUrl(scriptBasename, compiledFileUrl)

              const scriptBeforeCompilation = scriptsExternalized[scriptSrc]
              const scriptTransformResult = await transformJs({
                projectDirectoryUrl,
                code: scriptBeforeCompilation,
                url: scriptOriginalFileUrl,
                urlAfterTransform: scriptAfterTransformFileUrl,
                babelPluginMap: compileIdToBabelPluginMap(compileId, { groupMap, babelPluginMap }),
                convertMap,
                transformTopLevelAwait,
                transformModuleIntoSystemFormat: true,
              })
              const sourcemapFileUrl = resolveUrl(
                `${scriptBasename}.map`,
                scriptAfterTransformFileUrl,
              )

              let { code, map } = scriptTransformResult
              const sourcemapFileRelativePathForModule = urlToRelativeUrl(
                sourcemapFileUrl,
                compiledFileUrl,
              )
              code = appendSourceMappingAsExternalUrl(code, sourcemapFileRelativePathForModule)
              assets = [...assets, scriptAssetUrl, sourcemapFileUrl]
              assetsContent = [...assetsContent, code, JSON.stringify(map, null, "  ")]
            }),
          )

          return {
            compiledSource: htmlAfterCompilation,
            contentType: "text/html",
            sources: [originalFileUrl],
            sourcesContent: [htmlBeforeCompilation],
            assets,
            assetsContent,
          }
        },
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
