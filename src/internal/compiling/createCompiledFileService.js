/* eslint-disable import/max-dependencies */
import { urlToContentType, serveFile } from "@jsenv/server"
import { resolveUrl, resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import {
  COMPILE_ID_OTHERWISE,
  COMPILE_ID_BUILD_GLOBAL,
  COMPILE_ID_BUILD_GLOBAL_FILES,
  COMPILE_ID_BUILD_COMMONJS,
  COMPILE_ID_BUILD_COMMONJS_FILES,
} from "../CONSTANTS.js"
import { jsenvToolbarHtmlUrl, jsenvBrowserSystemBuildUrl } from "../jsenvInternalFiles.js"
import { transformImportmap } from "./transformImportmap.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./js-compilation-service/transformResultToCompilationResult.js"
import { compileFile } from "./compileFile.js"
import { serveBuild } from "./serveBuild.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  manipulateHtmlAst,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  getUniqueNameForInlineHtmlNode,
  removeHtmlNodeAttribute,
  setHtmlNodeText,
} from "./compileHtml.js"
import { setJavaScriptSourceMappingUrl } from "../sourceMappingURLUtils.js"
import { generateCompiledFileAssetUrl } from "./compile-directory/compile-asset.js"

export const createCompiledFileService = ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrl,
  importMeta,
  importDefaultExtension,

  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  babelPluginMap,
  groupMap,
  convertMap,
  scriptInjections,

  projectFileRequestedCallback,
  useFilesystemAsCache,
  writeOnFilesystem,
  compileCacheStrategy,
  sourcemapExcludeSources,
}) => {
  const jsenvBrowserBuildUrlRelativeToProject = urlToRelativeUrl(
    jsenvBrowserSystemBuildUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    const { origin, ressource } = request
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
      return serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true,
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

    if (contentType === "application/importmap+json") {
      return compileFile({
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

        compile: (importmapBeforeTransformation) =>
          transformImportmap(importmapBeforeTransformation, {
            logger,
            projectDirectoryUrl,
            outDirectoryRelativeUrl,
            originalFileUrl,
            compiledFileUrl,
            projectFileRequestedCallback,
            request,
          }),
      })
    }

    if (contentType === "application/javascript") {
      if (compileId === COMPILE_ID_BUILD_GLOBAL || compileId === COMPILE_ID_BUILD_COMMONJS) {
        return serveBuild({
          cancellationToken,
          logger,

          projectDirectoryUrl,
          importMapFileRelativeUrl,
          originalFileUrl,
          compiledFileUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin: request.origin,
          importDefaultExtension,

          babelPluginMap,
          projectFileRequestedCallback,
          request,
          format: compileId === COMPILE_ID_BUILD_GLOBAL ? "global" : "commonjs",
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
            importMetaEnvFileRelativeUrl,
            importMeta,
            code: originalFileContent,
            url: originalFileUrl,
            urlAfterTransform: compiledFileUrl,
            babelPluginMap: compileIdToBabelPluginMap(compileId, { groupMap, babelPluginMap }),
            convertMap,
            transformTopLevelAwait,
            moduleOutFormat: compileIdIsForBuildFiles(compileId)
              ? // we are compiling for rollup, do not transform into systemjs format
                "esmodule"
              : moduleOutFormat,
            importMetaFormat:
              // eslint-disable-next-line no-nested-ternary
              compileId === COMPILE_ID_BUILD_GLOBAL_FILES
                ? "global"
                : compileId === COMPILE_ID_BUILD_COMMONJS_FILES
                ? "commonjs"
                : importMetaFormat,
          })
          const sourcemapFileUrl = `${compiledFileUrl}.map`

          return transformResultToCompilationResult(transformResult, {
            projectDirectoryUrl,
            originalFileContent,
            originalFileUrl,
            compiledFileUrl,
            sourcemapFileUrl,
            sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
            sourcemapExcludeSources,
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
          // parsing html should not throw any syntax error
          // invalid html markup is converted into some valid html
          // in the worst cases the faulty html string special characters
          // will be html encoded.
          // All this comment to say we don't have to try/catch html parsing
          const htmlAst = parseHtmlString(htmlBeforeCompilation)
          manipulateHtmlAst(htmlAst, {
            scriptInjections: [
              {
                src: `/${jsenvBrowserBuildUrlRelativeToProject}`,
              },
              // todo: this is dirty because it means
              // compile server is aware of exploring and jsenv toolbar
              // instead this should be moved to startExploring
              ...(originalFileUrl === jsenvToolbarHtmlUrl ? [] : scriptInjections),
            ],
          })
          const { scripts } = parseHtmlAstRessources(htmlAst)

          let hasImportmap = false
          const inlineScriptsContentMap = {}
          scripts.forEach((script) => {
            const typeAttribute = getHtmlNodeAttributeByName(script, "type")
            const srcAttribute = getHtmlNodeAttributeByName(script, "src")

            if (typeAttribute && typeAttribute.value === "importmap" && srcAttribute) {
              hasImportmap = true
              typeAttribute.value = "jsenv-importmap"
              return
            }
            if (typeAttribute && typeAttribute.value === "module" && srcAttribute) {
              removeHtmlNodeAttribute(script, typeAttribute)
              removeHtmlNodeAttribute(script, srcAttribute)
              setHtmlNodeText(
                script,
                `window.__jsenv__.importFile(${JSON.stringify(srcAttribute.value)})`,
              )
              return
            }
            const textNode = getHtmlNodeTextNode(script)
            if (typeAttribute && typeAttribute.value === "module" && textNode) {
              const scriptAssetUrl = generateCompiledFileAssetUrl(
                compiledFileUrl,
                getUniqueNameForInlineHtmlNode(script, scripts, `[id].js`),
              )
              const specifier = `./${urlToRelativeUrl(scriptAssetUrl, compiledFileUrl)}`
              inlineScriptsContentMap[specifier] = textNode.value

              removeHtmlNodeAttribute(script, typeAttribute)
              removeHtmlNodeAttribute(script, srcAttribute)
              setHtmlNodeText(script, `window.__jsenv__.importFile(${JSON.stringify(specifier)})`)
              return
            }
          })
          // ensure there is at least the importmap needed for jsenv
          if (hasImportmap === false) {
            manipulateHtmlAst(htmlAst, {
              scriptInjections: [
                {
                  type: "jsenv-importmap",
                  // in case there is no importmap, use a top level one
                  src: `/${outDirectoryRelativeUrl}${compileId}/${importMapFileRelativeUrl}`,
                },
              ],
            })
          }

          const htmlAfterTransformation = stringifyHtmlAst(htmlAst)

          let assets = []
          let assetsContent = []
          await Promise.all(
            Object.keys(inlineScriptsContentMap).map(async (scriptSrc) => {
              const scriptAssetUrl = resolveUrl(scriptSrc, compiledFileUrl)
              const scriptBasename = urlToRelativeUrl(scriptAssetUrl, compiledFileUrl)
              const scriptOriginalFileUrl = resolveUrl(scriptBasename, originalFileUrl)
              const scriptAfterTransformFileUrl = resolveUrl(scriptBasename, compiledFileUrl)

              const scriptBeforeCompilation = inlineScriptsContentMap[scriptSrc]
              let scriptTransformResult
              try {
                scriptTransformResult = await transformJs({
                  projectDirectoryUrl,
                  importMetaEnvFileRelativeUrl,
                  importMeta,
                  code: scriptBeforeCompilation,
                  url: scriptOriginalFileUrl,
                  urlAfterTransform: scriptAfterTransformFileUrl,
                  babelPluginMap: compileIdToBabelPluginMap(compileId, {
                    groupMap,
                    babelPluginMap,
                  }),
                  convertMap,
                  transformTopLevelAwait,
                  moduleOutFormat,
                  importMetaFormat,
                })
              } catch (e) {
                // If there is a syntax error in inline script
                // we put the raw script without transformation.
                // when systemjs will try to instantiate to script it
                // will re-throw this syntax error.
                // Thanks to this we see the syntax error in the
                // document and livereloading still works
                // because we gracefully handle this error
                if (e.code === "PARSE_ERROR") {
                  const code = scriptBeforeCompilation
                  assets = [...assets, scriptAssetUrl]
                  assetsContent = [...assetsContent, code]
                  return
                }
                throw e
              }
              const sourcemapFileUrl = resolveUrl(
                `${scriptBasename}.map`,
                scriptAfterTransformFileUrl,
              )

              let { code, map } = scriptTransformResult
              const sourcemapFileRelativePathForModule = urlToRelativeUrl(
                sourcemapFileUrl,
                compiledFileUrl,
              )
              code = setJavaScriptSourceMappingUrl(code, sourcemapFileRelativePathForModule)
              assets = [...assets, scriptAssetUrl, sourcemapFileUrl]
              assetsContent = [...assetsContent, code, JSON.stringify(map, null, "  ")]
            }),
          )

          return {
            compiledSource: htmlAfterTransformation,
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

const compileIdIsForBuildFiles = (compileId) => {
  return (
    compileId === COMPILE_ID_BUILD_GLOBAL_FILES || compileId === COMPILE_ID_BUILD_COMMONJS_FILES
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
  if (compileIdIsForBuildFiles(compileId)) {
    compiledIdForGroupMap = getWorstCompileId(groupMap)
    babelPluginMapForGroupMap = {}
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
