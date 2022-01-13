import {
  resolveUrl,
  urlToFilename,
  urlToRelativeUrl,
  urlIsInsideOf,
} from "@jsenv/filesystem"
import { moveImportMap, composeTwoImportMaps } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import { jsenvDistDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  BROWSER_RUNTIME_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  TOOLBAR_INJECTOR_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import-resolution/importmap_default.js"

import {
  generateSourcemapUrl,
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
  getIdForInlineHtmlNode,
  removeHtmlNodeAttribute,
  setHtmlNodeText,
  visitHtmlAst,
  replaceHtmlNode,
} from "./compileHtml.js"
import { generateCompilationAssetUrl } from "./compile-directory/compile-asset.js"

export const compileHtml = async ({
  // cancellationToken,
  logger,
  // request,
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
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

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const addHtmlSourceFile = ({ url, content }) => {
    sources.push(url)
    sourcesContent.push(content)
  }
  addHtmlSourceFile({ url, content: code })

  const { scripts } = parseHtmlAstRessources(htmlAst)
  const htmlDependencies = collectHtmlDependenciesFromAst(htmlAst)

  const htmlAssetGenerators = []
  const htmlMutations = []
  const addHtmlAssetGenerator = (htmlAssetGenerator) => {
    htmlAssetGenerators.push(htmlAssetGenerator)
  }
  const addHtmlMutation = (htmlMutation) => {
    htmlMutations.push(htmlMutation)
  }
  const addHtmlDependency = ({ htmlNode, specifier }) => {
    htmlDependencies.push({
      htmlNode,
      specifier,
    })
  }

  const importmapInfo = await visitImportmapScript({
    logger,
    url,
    compiledUrl,
    projectDirectoryUrl,
    compileId,
    outDirectoryRelativeUrl,
    scripts,
    addHtmlSourceFile,
  })
  const importmap = (await importmapInfo.load()) || {}
  const importmapAsText = JSON.stringify(importmap, null, "  ")
  importmapInfo.inlinedFrom = importmapInfo.url
  importmapInfo.text = importmapAsText
  addHtmlMutation(() => {
    if (importmapInfo.needsInjection) {
      manipulateHtmlAst(htmlAst, {
        scriptInjections: [
          {
            type:
              moduleOutFormat === "systemjs"
                ? "systemjs-importmap"
                : "importmap",
            // in case there is no importmap, force the presence
            // so that '@jsenv/core/' are still remapped
            text: importmapAsText,
          },
        ],
      })
    } else {
      replaceHtmlNode(
        importmapInfo.script,
        `<script type="${
          moduleOutFormat === "systemjs" ? "systemjs-importmap" : "importmap"
        }">${importmapAsText}</script>`,
        {
          attributesToIgnore: ["src"],
        },
      )
    }
  })
  onHtmlImportmapInfo({
    htmlUrl: url,
    importmapInfo,
  })

  await visitScripts({
    logger,
    projectDirectoryUrl,
    compileServerOrigin,
    jsenvDirectoryRelativeUrl,
    url,
    compiledUrl,
    scripts,
    addHtmlSourceFile,
    addHtmlAssetGenerator,
    addHtmlMutation,
    addHtmlDependency,

    babelPluginMap,
    moduleOutFormat,
    importMetaFormat,
    topLevelAwait,
    sourcemapMethod,
  })
  await Promise.all(
    htmlAssetGenerators.map(async (htmlAssetGenerator) => {
      const assetInfos = await htmlAssetGenerator()
      assetInfos.forEach((assetInfo) => {
        assets.push(assetInfo.url)
        assetsContent.push(assetInfo.content)
      })
    }),
  )
  htmlAssetGenerators.length = 0

  htmlMutations.forEach((htmlMutation) => {
    htmlMutation()
  })
  htmlMutations.length = 0
  const htmlAfterTransformation = stringifyHtmlAst(htmlAst)

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

const visitImportmapScript = async ({
  logger,
  url,
  compiledUrl,
  projectDirectoryUrl,
  compileId,
  outDirectoryRelativeUrl,
  scripts,
  addHtmlSourceFile,
}) => {
  const importmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    return type === "importmap"
  })
  if (importmapScripts.length === 0) {
    return {
      needsInjection: true,
      url: compiledUrl,
      load: () => {
        const defaultImportMap = getDefaultImportmap(compiledUrl, {
          projectDirectoryUrl,
          compileDirectoryUrl: `${projectDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/`,
        })
        return defaultImportMap
      },
    }
  }

  if (importmapScripts.length > 1) {
    logger.error("HTML file must contain max 1 importmap")
  }
  const firstImportmapScript = importmapScripts[0]
  const srcAttribute = getHtmlNodeAttributeByName(firstImportmapScript, "src")
  const src = srcAttribute ? srcAttribute.value : ""
  if (src) {
    const importmapUrl = resolveUrl(src, url)
    const importmapInfo = {
      script: firstImportmapScript,
      url: importmapUrl,
      load: async () => {
        const importMapResponse = await fetchUrl(importmapUrl)
        if (importMapResponse.status === 200) {
          const importmapAsText = await importMapResponse.text()
          addHtmlSourceFile({
            url: importmapUrl,
            content: importmapAsText,
          })
          let htmlImportmap = JSON.parse(importmapAsText)
          htmlImportmap = moveImportMap(htmlImportmap, importmapUrl, url)
          return htmlImportmap
        }
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
        return null
      },
    }
    return importmapInfo
  }
  const importmapInfo = {
    script: firstImportmapScript,
    url: compiledUrl,
    load: () => {
      const jsenvImportmap = getDefaultImportmap(compiledUrl, {
        projectDirectoryUrl,
        compileDirectoryUrl: `${projectDirectoryUrl}${compileId}/${outDirectoryRelativeUrl}`,
      })
      const htmlImportmap = JSON.parse(
        getHtmlNodeTextNode(firstImportmapScript).value,
      )
      const importmap = composeTwoImportMaps(jsenvImportmap, htmlImportmap)
      return importmap
    },
  }
  return importmapInfo
}

const visitScripts = async ({
  logger,
  projectDirectoryUrl,
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,
  scripts,
  addHtmlSourceFile,
  addHtmlAssetGenerator,
  addHtmlMutation,
  addHtmlDependency,

  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  sourcemapMethod,
}) => {
  scripts.forEach((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    const textNode = getHtmlNodeTextNode(script)

    if (type === "module") {
      if (src) {
        addHtmlMutation(() => {
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
        })
        return
      }

      const scriptId = getIdForInlineHtmlNode(script, scripts)
      const inlineScriptName = `${scriptId}.js`
      const scriptOriginalUrl = resolveUrl(inlineScriptName, url)
      const scriptCompiledUrl = generateCompilationAssetUrl(
        compiledUrl,
        inlineScriptName,
      )
      addHtmlAssetGenerator(async () => {
        return transformHtmlScript({
          projectDirectoryUrl,
          jsenvDirectoryRelativeUrl,
          url: scriptOriginalUrl,
          compiledUrl: scriptCompiledUrl,
          code: textNode.value,

          type: "module",
          babelPluginMap,
          moduleOutFormat,
          importMetaFormat,
          topLevelAwait,
          sourcemapMethod,
        })
      })
      const specifier = `./${urlToRelativeUrl(scriptCompiledUrl, compiledUrl)}`
      addHtmlMutation(() => {
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
          `window.__jsenv__.${jsenvMethod}(${JSON.stringify(specifier)})`,
        )
      })
      addHtmlDependency({
        htmlNode: script,
        specifier,
      })
      return
    }

    if (type === "application/javascript" || type === "text/javascript") {
      if (src) {
        const htmlServerUrl = url.replace(
          projectDirectoryUrl,
          `${compileServerOrigin}/`,
        )
        const scriptOriginalServerUrl = resolveUrl(src, htmlServerUrl)
        const scriptOriginalUrl = scriptOriginalServerUrl.replace(
          `${compileServerOrigin}/`,
          projectDirectoryUrl,
        )
        const fileIsInsideJsenvDistDirectory = urlIsInsideOf(
          scriptOriginalUrl,
          jsenvDistDirectoryUrl,
        )
        if (fileIsInsideJsenvDistDirectory) {
          return
        }

        const scriptCompiledUrl = generateCompilationAssetUrl(
          compiledUrl,
          urlToFilename(scriptOriginalUrl),
        )
        addHtmlAssetGenerator(async () => {
          // we fetch scriptOriginalUrl on purpose because we do
          // the transformation here and not in compile server
          // (because compile server would think it's a module script
          // and add things like systemjs)
          const scriptResponse = await fetchUrl(scriptOriginalUrl)
          if (scriptResponse.status !== 200) {
            logger.warn(
              createDetailedMessage(
                scriptResponse.status === 404
                  ? `script file cannot be found.`
                  : `script file unexpected response status (${scriptResponse.status}).`,
                {
                  "script url": script.url,
                  "html url": url,
                },
              ),
            )
            return []
          }
          const scriptAsText = await scriptResponse.text()
          addHtmlSourceFile({
            url: scriptOriginalUrl,
            content: scriptAsText,
          })
          return transformHtmlScript({
            projectDirectoryUrl,
            jsenvDirectoryRelativeUrl,
            url: scriptOriginalUrl,
            compiledUrl: scriptCompiledUrl,
            code: scriptAsText,

            type: "classic",
            babelPluginMap,
            moduleOutFormat,
            importMetaFormat,
            topLevelAwait,
            sourcemapMethod,
          })
        })
        addHtmlMutation(() => {
          srcAttribute.value = `./${urlToRelativeUrl(
            scriptCompiledUrl,
            compiledUrl,
          )}`
        })
        return
      }
      const scriptId = getIdForInlineHtmlNode(script, scripts)
      const inlineScriptName = `${scriptId}.js`
      const scriptOriginalUrl = resolveUrl(inlineScriptName, url)
      const scriptCompiledUrl = generateCompilationAssetUrl(
        compiledUrl,
        inlineScriptName,
      )
      addHtmlAssetGenerator(async () => {
        const htmlAssets = await transformHtmlScript({
          projectDirectoryUrl,
          jsenvDirectoryRelativeUrl,
          url: scriptOriginalUrl,
          compiledUrl: scriptCompiledUrl,
          code: textNode.value,

          type: "classic",
          babelPluginMap,
          moduleOutFormat,
          importMetaFormat,
          topLevelAwait,
          sourcemapMethod,
        })
        addHtmlMutation(() => {
          setHtmlNodeText(script, htmlAssets[0].content)
        })
        return htmlAssets
      })
      return
    }
  })
}

const transformHtmlScript = async ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,
  code,
  type,

  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  sourcemapMethod,
}) => {
  let transformResult
  try {
    transformResult = await transformJs({
      code,
      url,
      compiledUrl,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,

      babelPluginMap,
      moduleOutFormat: type === "module" ? moduleOutFormat : "global",
      importMetaFormat,
      topLevelAwait: type === "module" ? topLevelAwait : false,
      babelHelpersInjectionAsImport: type === "module" ? undefined : false,
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
      return [{ url, content: code }]
    }
    throw e
  }

  code = transformResult.code
  let map = transformResult.map
  const sourcemapUrl = generateSourcemapUrl(compiledUrl)
  if (sourcemapMethod === "inline") {
    code = setJavaScriptSourceMappingUrl(code, sourcemapToBase64Url(map))
    return [
      {
        url: compiledUrl,
        content: code,
      },
    ]
  }
  const sourcemapSpecifier = urlToRelativeUrl(sourcemapUrl, compiledUrl)
  code = setJavaScriptSourceMappingUrl(code, sourcemapSpecifier)
  return [
    {
      url: compiledUrl,
      content: code,
    },
    {
      url: sourcemapUrl,
      content: JSON.stringify(map, null, "  "),
    },
  ]
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
