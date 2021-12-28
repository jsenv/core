import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { moveImportMap, composeTwoImportMaps } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import {
  BROWSER_RUNTIME_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  TOOLBAR_INJECTOR_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
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

export const compileHtml = async ({
  // cancellationToken,
  logger,
  // request,
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileId,

  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,

  sourcemapMethod,

  jsenvScriptInjection = true,
  jsenvEventSourceClientInjection,
  jsenvToolbarInjection,
  onHtmlImportmapInfo,
}) => {
  const browserRuntimeBuildUrlRelativeToProject = urlToRelativeUrl(
    BROWSER_RUNTIME_BUILD_URL,
    projectDirectoryUrl,
  )

  const eventSourceClientBuildRelativeUrlForProject = urlToRelativeUrl(
    EVENT_SOURCE_CLIENT_BUILD_URL,
    projectDirectoryUrl,
  )

  const toolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    TOOLBAR_INJECTOR_BUILD_URL,
    projectDirectoryUrl,
  )

  // ideally we should try/catch html syntax error
  const htmlAst = parseHtmlString(code)

  if (moduleOutFormat !== "esmodule") {
    await mutateRessourceHints(htmlAst)
  }

  manipulateHtmlAst(htmlAst, {
    scriptInjections: [
      ...(jsenvScriptInjection
        ? [
            {
              src: `/${browserRuntimeBuildUrlRelativeToProject}`,
            },
          ]
        : []),
      ...(jsenvEventSourceClientInjection
        ? [
            {
              src: `/${eventSourceClientBuildRelativeUrlForProject}`,
            },
          ]
        : []),
      ...(jsenvToolbarInjection
        ? [
            {
              src: `/${toolbarInjectorBuildRelativeUrlForProject}`,
              defer: "",
              async: "",
            },
          ]
        : []),
    ],
  })

  let sources = []
  let sourcesContent = []
  const { scripts } = parseHtmlAstRessources(htmlAst)
  let importmapInfo = null
  scripts.forEach((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    if (typeAttribute && typeAttribute.value === "importmap") {
      if (importmapInfo) {
        console.error("HTML file must contain max 1 importmap")
      } else {
        const srcAttribute = getHtmlNodeAttributeByName(script, "src")
        const src = srcAttribute ? srcAttribute.value : ""
        if (src) {
          importmapInfo = {
            script,
            url: resolveUrl(src, url),
            loadAsText: async () => {
              const importMapResponse = await fetchUrl(importmapInfo.url)
              if (importMapResponse.status !== 200) {
                logger.warn(
                  createDetailedMessage(
                    importMapResponse.status === 404
                      ? `importmap script file cannot be found.`
                      : `importmap script file unexpected response status (${importMapResponse.status}).`,
                    {
                      "importmap url": importmapInfo.url,
                      "html url": url,
                    },
                  ),
                )
                return "{}"
              }
              const importmapAsText = await importMapResponse.text()
              sources.push(importmapInfo.url)
              sourcesContent.push(importmapAsText)

              const importMapMoved = moveImportMap(
                JSON.parse(importmapAsText),
                importmapInfo.url,
                url,
              )
              const compiledImportmapAsText = JSON.stringify(
                importMapMoved,
                null,
                "  ",
              )
              return compiledImportmapAsText
            },
          }
        } else {
          importmapInfo = {
            script,
            url: compiledUrl,
            loadAsText: () => getHtmlNodeTextNode(script).value,
          }
        }
      }
    }
  })
  if (importmapInfo) {
    const htmlImportMap = JSON.parse(await importmapInfo.loadAsText())
    const importMapFromJsenv = getDefaultImportMap({
      importMapFileUrl: compiledUrl,
      projectDirectoryUrl,
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
    })
    const mappings = composeTwoImportMaps(importMapFromJsenv, htmlImportMap)
    const importmapAsText = JSON.stringify(mappings, null, "  ")
    replaceHtmlNode(
      importmapInfo.script,
      `<script type="${
        moduleOutFormat === "systemjs" ? "jsenv-importmap" : "importmap"
      }">${importmapAsText}</script>`,
      {
        attributesToIgnore: ["src"],
      },
    )
    importmapInfo.inlinedFrom = importmapInfo.url
    importmapInfo.url = compiledUrl
    importmapInfo.text = importmapAsText
  } else {
    // inject a default importmap
    const defaultImportMap = getDefaultImportMap({
      importMapFileUrl: compiledUrl,
      projectDirectoryUrl,
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
    })
    const importmapAsText = JSON.stringify(defaultImportMap, null, "  ")
    manipulateHtmlAst(htmlAst, {
      scriptInjections: [
        {
          type:
            moduleOutFormat === "systemjs" ? "jsenv-importmap" : "importmap",
          // in case there is no importmap, force the presence
          // so that '@jsenv/core/' are still remapped
          text: importmapAsText,
        },
      ],
    })
    importmapInfo = {
      url: compiledUrl,
      text: importmapAsText,
    }
  }
  onHtmlImportmapInfo({
    htmlUrl: url,
    importmapInfo,
  })

  const htmlDependencies = collectHtmlDependenciesFromAst(htmlAst)
  const inlineScriptsContentMap = {}
  scripts.forEach((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    // remote module script
    if (typeAttribute && typeAttribute.value === "module" && src) {
      if (moduleOutFormat === "systemjs") {
        removeHtmlNodeAttribute(script, typeAttribute)
      }
      removeHtmlNodeAttribute(script, srcAttribute)
      const jsenvMethod =
        moduleOutFormat === "systemjs"
          ? "executeFileUsingSystemJs"
          : "executeFileUsingDynamicImport"
      setHtmlNodeText(
        script,
        `window.__jsenv__.${jsenvMethod}(${JSON.stringify(src)})`,
      )
      return
    }

    // inline module script
    const textNode = getHtmlNodeTextNode(script)
    if (typeAttribute && typeAttribute.value === "module" && textNode) {
      if (moduleOutFormat === "systemjs") {
        removeHtmlNodeAttribute(script, typeAttribute)
      }
      removeHtmlNodeAttribute(script, srcAttribute)
      const scriptAssetUrl = generateCompiledFileAssetUrl(
        compiledUrl,
        getUniqueNameForInlineHtmlNode(script, scripts, `[id].js`),
      )
      const specifier = `./${urlToRelativeUrl(scriptAssetUrl, compiledUrl)}`
      inlineScriptsContentMap[specifier] = textNode.value
      const jsenvMethod =
        moduleOutFormat === "systemjs"
          ? "executeFileUsingSystemJs"
          : "executeFileUsingDynamicImport"
      setHtmlNodeText(
        script,
        `window.__jsenv__.${jsenvMethod}(${JSON.stringify(specifier)})`,
      )
      htmlDependencies.push({
        htmlNode: script,
        specifier,
      })
      return
    }
  })
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

          babelPluginMap,
          moduleOutFormat,
          importMetaFormat,
          topLevelAwait,
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
  sources.push(url)
  sourcesContent.push(code)

  return {
    contentType: "text/html",
    compiledSource: htmlAfterTransformation,
    sources,
    sourcesContent,
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
