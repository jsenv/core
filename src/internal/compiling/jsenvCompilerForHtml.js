import { urlToContentType } from "@jsenv/server"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  jsenvBrowserSystemFileInfo,
  jsenvToolbarHtmlFileInfo,
  jsenvToolbarInjectorFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { getDefaultImportMap } from "@jsenv/core/src/internal/import-resolution/importmap-default.js"
import { setJavaScriptSourceMappingUrl } from "../sourceMappingURLUtils.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { compileIdToBabelPluginMap } from "./jsenvCompilerForJavaScript.js"
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
  visitHtmlAst,
  replaceHtmlNode,
} from "./compileHtml.js"
import { generateCompiledFileAssetUrl } from "./compile-directory/compile-asset.js"

const compileHtmlFile = ({
  // cancellationToken,
  // logger,
  // request,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,

  jsenvToolbarInjection,
}) => {
  const contentType = urlToContentType(originalFileUrl)
  if (contentType !== "text/html") {
    return null
  }

  const jsenvBrowserBuildUrlRelativeToProject = urlToRelativeUrl(
    jsenvBrowserSystemFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarInjectorFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )

  return {
    compile: async (htmlBeforeCompilation) => {
      // ideally we should try/catch html syntax error
      const htmlAst = parseHtmlString(htmlBeforeCompilation)

      if (moduleOutFormat !== "esmodule") {
        await mutateRessourceHints(htmlAst)
      }

      manipulateHtmlAst(htmlAst, {
        scriptInjections: [
          {
            src: `/${jsenvBrowserBuildUrlRelativeToProject}`,
          },
          ...(jsenvToolbarInjection &&
          originalFileUrl !== jsenvToolbarHtmlFileInfo.url
            ? [
                {
                  src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`,
                },
              ]
            : []),
        ],
      })

      const { scripts } = parseHtmlAstRessources(htmlAst)

      let hasImportmap = false
      const inlineScriptsContentMap = {}
      scripts.forEach((script) => {
        const typeAttribute = getHtmlNodeAttributeByName(script, "type")
        const srcAttribute = getHtmlNodeAttributeByName(script, "src")

        // remote
        if (
          typeAttribute &&
          typeAttribute.value === "importmap" &&
          srcAttribute
        ) {
          hasImportmap = true
          typeAttribute.value = "jsenv-importmap"
          return
        }
        if (typeAttribute && typeAttribute.value === "module" && srcAttribute) {
          removeHtmlNodeAttribute(script, typeAttribute)
          removeHtmlNodeAttribute(script, srcAttribute)
          setHtmlNodeText(
            script,
            `window.__jsenv__.executeFileUsingSystemJs(${JSON.stringify(
              srcAttribute.value,
            )})`,
          )
          return
        }
        // inline
        const textNode = getHtmlNodeTextNode(script)
        if (typeAttribute && typeAttribute.value === "module" && textNode) {
          const scriptAssetUrl = generateCompiledFileAssetUrl(
            compiledFileUrl,
            getUniqueNameForInlineHtmlNode(script, scripts, `[id].js`),
          )
          const specifier = `./${urlToRelativeUrl(
            scriptAssetUrl,
            compiledFileUrl,
          )}`
          inlineScriptsContentMap[specifier] = textNode.value

          removeHtmlNodeAttribute(script, typeAttribute)
          removeHtmlNodeAttribute(script, srcAttribute)
          setHtmlNodeText(
            script,
            `window.__jsenv__.executeFileUsingSystemJs(${JSON.stringify(
              specifier,
            )})`,
          )
          return
        }
      })
      if (hasImportmap === false) {
        const defaultImportMap = getDefaultImportMap({
          importMapFileUrl: compiledFileUrl,
          projectDirectoryUrl,
          compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
        })

        manipulateHtmlAst(htmlAst, {
          scriptInjections: [
            {
              type: "jsenv-importmap",
              // in case there is no importmap, force the presence
              // so that '@jsenv/core/' are still remapped
              text: JSON.stringify(defaultImportMap, null, "  "),
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
          const scriptBasename = urlToRelativeUrl(
            scriptAssetUrl,
            compiledFileUrl,
          )
          const scriptOriginalFileUrl = resolveUrl(
            scriptBasename,
            originalFileUrl,
          )
          const scriptAfterTransformFileUrl = resolveUrl(
            scriptBasename,
            compiledFileUrl,
          )

          const scriptBeforeCompilation = inlineScriptsContentMap[scriptSrc]
          let scriptTransformResult
          try {
            scriptTransformResult = await transformJs({
              projectDirectoryUrl,
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
          code = setJavaScriptSourceMappingUrl(
            code,
            sourcemapFileRelativePathForModule,
          )
          assets = [...assets, scriptAssetUrl, sourcemapFileUrl]
          assetsContent = [
            ...assetsContent,
            code,
            JSON.stringify(map, null, "  "),
          ]
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
  }
}

// transform <link type="modulepreload"> into <link type="preload">
const mutateRessourceHints = async (htmlAst) => {
  const ressourceHints = []
  visitHtmlAst(htmlAst, (htmlNode) => {
    if (htmlNode.nodeName !== "link") return
    const relAttribute = getHtmlNodeAttributeByName(htmlNode, "rel")
    const rel = relAttribute ? relAttribute.value : ""
    const isRessourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(rel)
    if (!isRessourceHint) return

    ressourceHints.push({ rel, htmlNode })
  })

  const mutations = []
  await Promise.all(
    ressourceHints.map(async (ressourceHint) => {
      const hrefAttribute = getHtmlNodeAttributeByName(
        ressourceHint.htmlNode,
        "href",
      )
      const href = hrefAttribute ? hrefAttribute.value : ""
      if (!href) return

      // - as="script" -> as="fetch" because jsenv uses
      //   fetch to load ressources (see "fetchSource" in createBrowserRuntime.js)
      // - "modulepreload" -> "preload" because it's now regular js script
      const asAttribute = getHtmlNodeAttributeByName(
        ressourceHint.htmlNode,
        "as",
      )

      if (ressourceHint.rel === "modulepreload") {
        mutations.push(() => {
          replaceHtmlNode(
            ressourceHint.htmlNode,
            `<link rel="preload" as="fetch" crossorigin />`,
          )
        })
        return
      }

      if (asAttribute && asAttribute.value === "script") {
        mutations.push(() => {
          replaceHtmlNode(
            ressourceHint.htmlNode,
            `<link as="fetch" crossorigin />`,
          )
        })
        return
      }
    }),
  )
  mutations.forEach((mutation) => mutation())
}

export const jsenvCompilerForHtml = {
  "jsenv-compiler-html": compileHtmlFile,
}
