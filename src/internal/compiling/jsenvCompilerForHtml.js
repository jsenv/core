import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  jsenvBrowserSystemFileInfo,
  jsenvToolbarHtmlFileInfo,
  jsenvToolbarInjectorFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { getDefaultImportMap } from "@jsenv/core/src/internal/import-resolution/importmap-default.js"
import {
  setJavaScriptSourceMappingUrl,
  sourcemapToBase64Url,
} from "../sourceMappingURLUtils.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  collectHtmlDependenciesFromAst,
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
import { composeTwoImportMaps } from "@jsenv/importmap"

export const compileHtml = async ({
  // cancellationToken,
  // logger,
  // request,
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileId,

  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  babelPluginMap,

  jsenvToolbarInjection,
  sourcemapMethod,
}) => {
  const jsenvBrowserBuildUrlRelativeToProject = urlToRelativeUrl(
    jsenvBrowserSystemFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarInjectorFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )

  // ideally we should try/catch html syntax error
  const htmlAst = parseHtmlString(code)

  if (moduleOutFormat !== "esmodule") {
    await mutateRessourceHints(htmlAst)
  }

  manipulateHtmlAst(htmlAst, {
    scriptInjections: [
      {
        src: `/${jsenvBrowserBuildUrlRelativeToProject}`,
      },
      ...(jsenvToolbarInjection && url !== jsenvToolbarHtmlFileInfo.url
        ? [
            {
              src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`,
            },
          ]
        : []),
    ],
  })

  const { scripts } = parseHtmlAstRessources(htmlAst)
  const htmlDependencies = collectHtmlDependenciesFromAst(htmlAst)

  let hasImportmap = false
  const inlineScriptsContentMap = {}
  scripts.forEach((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")

    // importmap
    if (typeAttribute && typeAttribute.value === "importmap") {
      if (srcAttribute) {
        hasImportmap = true
        typeAttribute.value = "jsenv-importmap"
        return
      }
      const defaultImportMap = getDefaultImportMap({
        importMapFileUrl: compiledUrl,
        projectDirectoryUrl,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
      })
      const inlineImportMap = JSON.parse(getHtmlNodeTextNode(script).value)
      const mappings = composeTwoImportMaps(defaultImportMap, inlineImportMap)
      hasImportmap = true
      typeAttribute.value = "jsenv-importmap"
      setHtmlNodeText(script, JSON.stringify(mappings, null, "  "))
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
        compiledUrl,
        getUniqueNameForInlineHtmlNode(script, scripts, `[id].js`),
      )
      const specifier = `./${urlToRelativeUrl(scriptAssetUrl, compiledUrl)}`
      inlineScriptsContentMap[specifier] = textNode.value

      removeHtmlNodeAttribute(script, typeAttribute)
      removeHtmlNodeAttribute(script, srcAttribute)
      setHtmlNodeText(
        script,
        `window.__jsenv__.executeFileUsingSystemJs(${JSON.stringify(
          specifier,
        )})`,
      )
      htmlDependencies.push({
        htmlNode: script,
        specifier,
      })
      return
    }
  })
  if (hasImportmap === false) {
    const defaultImportMap = getDefaultImportMap({
      importMapFileUrl: compiledUrl,
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
      const scriptAssetUrl = resolveUrl(scriptSrc, compiledUrl)
      const scriptBasename = urlToRelativeUrl(scriptAssetUrl, compiledUrl)
      const scriptOriginalFileUrl = resolveUrl(scriptBasename, url)
      const scriptCompiledFileUrl = resolveUrl(scriptBasename, compiledUrl)

      const scriptBeforeCompilation = inlineScriptsContentMap[scriptSrc]
      let scriptTransformResult
      try {
        scriptTransformResult = await transformJs({
          code: scriptBeforeCompilation,
          url: scriptOriginalFileUrl,
          compiledUrl: scriptCompiledFileUrl,
          projectDirectoryUrl,

          transformTopLevelAwait,
          moduleOutFormat,
          importMetaFormat,
          babelPluginMap,
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
        scriptCompiledFileUrl,
      )

      let { code, map } = scriptTransformResult
      const sourcemapFileRelativePathForModule = urlToRelativeUrl(
        sourcemapFileUrl,
        compiledUrl,
      )

      if (sourcemapMethod === "inline") {
        code = setJavaScriptSourceMappingUrl(code, sourcemapToBase64Url(map))
      } else {
        // TODO: respect "sourcemapMethod" parameter
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
      }
    }),
  )

  return {
    contentType: "text/html",
    compiledSource: htmlAfterTransformation,
    sources: [url],
    sourcesContent: [code],
    assets,
    assetsContent,
    dependencies: htmlDependencies.map(({ specifier }) => {
      return specifier
    }),
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

      // - "modulepreload" -> "preload" because it's now regular js script
      const asAttribute = getHtmlNodeAttributeByName(
        ressourceHint.htmlNode,
        "as",
      )

      if (ressourceHint.rel === "modulepreload") {
        mutations.push(() => {
          replaceHtmlNode(
            ressourceHint.htmlNode,
            `<link rel="preload" as="script" />`,
          )
        })
        return
      }

      if (asAttribute && asAttribute.value === "script") {
        mutations.push(() => {
          replaceHtmlNode(ressourceHint.htmlNode, `<link as="script" />`)
        })
        return
      }
    }),
  )
  mutations.forEach((mutation) => mutation())
}
