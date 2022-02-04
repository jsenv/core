import {
  resolveUrl,
  urlToFilename,
  urlToRelativeUrl,
  urlIsInsideOf,
} from "@jsenv/filesystem"
import { moveImportMap, composeTwoImportMaps } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"
import {
  jsenvCoreDirectoryUrl,
  jsenvDistDirectoryUrl,
} from "@jsenv/core/src/jsenv_file_urls.js"
import {
  BROWSER_CLIENT_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  TOOLBAR_INJECTOR_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import_resolution/importmap_default.js"
import { generateCompilationAssetUrl } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compile_asset.js"
import {
  generateSourcemapUrl,
  setJavaScriptSourceMappingUrl,
  sourcemapToBase64Url,
} from "@jsenv/core/src/internal/sourcemap_utils.js"

import { transformJs } from "../js/js_transformer.js"
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
  addHtmlNodeAttribute,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const compileHtml = async ({
  // cancellationToken,
  logger,
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,
  ressourceGraph,

  compileProfile,
  compileId,
  babelPluginMap,
  topLevelAwait,

  jsenvCorePackageVersion,
  jsenvScriptInjection = true,
  jsenvEventSourceClientInjection,
  jsenvToolbarInjection,

  onHtmlImportmapInfo,

  sourcemapMethod,
  code,
}) => {
  const compileDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}${compileId}/`
  const getJsenvDistFileSpecifier = (url) => {
    const urlVersioned = injectQuery(url, { version: jsenvCorePackageVersion })
    const relativeUrl = urlToRelativeUrl(urlVersioned, projectDirectoryUrl)
    return `/${relativeUrl}`
  }

  // ideally we should try/catch html syntax error
  const htmlAst = parseHtmlString(code)
  const scriptInjections = []
  if (jsenvScriptInjection) {
    // this one cannot use module format because it sets window.__jsenv__
    // used by other scripts
    scriptInjections.push({
      "src": getJsenvDistFileSpecifier(BROWSER_CLIENT_BUILD_URL),
      "data-jsenv": true,
    })
  }
  if (jsenvEventSourceClientInjection) {
    if (compileProfile.moduleOutFormat === "esmodule") {
      scriptInjections.push({
        "type": "module",
        "src": getJsenvDistFileSpecifier(
          new URL(
            "./src/internal/dev_server/event_source_client/event_source_client.js",
            jsenvCoreDirectoryUrl,
          ),
        ),
        "data-jsenv": true,
      })
    } else {
      scriptInjections.push({
        "src": getJsenvDistFileSpecifier(EVENT_SOURCE_CLIENT_BUILD_URL),
        "data-jsenv": true,
      })
    }
  }
  if (jsenvToolbarInjection) {
    if (compileProfile.moduleOutFormat === "esmodule") {
      scriptInjections.push({
        "type": "module",
        "src": getJsenvDistFileSpecifier(
          new URL(
            "./src/internal/dev_server/toolbar/toolbar_injector.js",
            jsenvCoreDirectoryUrl,
          ),
        ),
        "data-jsenv": true,
      })
    } else {
      scriptInjections.push({
        "src": getJsenvDistFileSpecifier(TOOLBAR_INJECTOR_BUILD_URL),
        "defer": "",
        "async": "",
        "data-jsenv": true,
      })
    }
  }
  manipulateHtmlAst(htmlAst, { scriptInjections })

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
  const injectHtmlDependency = ({ htmlNode, specifier }) => {
    htmlDependencies.push({
      htmlNode,
      specifier,
    })
  }
  if (compileProfile.moduleOutFormat !== "esmodule") {
    const ressourceHints = collectRessourceHints(htmlAst)
    await visitRessourceHints({
      ressourceHints,
      addHtmlMutation,
    })
  }
  await visitImportmapScripts({
    logger,
    projectDirectoryUrl,
    compileDirectoryUrl,
    url,
    compiledUrl,

    compileProfile,

    htmlAst,
    scripts,
    addHtmlMutation,
    addHtmlSourceFile,
    onHtmlImportmapInfo,
  })
  await visitScripts({
    logger,
    projectDirectoryUrl,
    jsenvRemoteDirectory,
    compileServerOrigin,
    url,
    compiledUrl,

    compileProfile,
    babelPluginMap,
    topLevelAwait,
    sourcemapMethod,

    scripts,
    addHtmlSourceFile,
    addHtmlAssetGenerator,
    addHtmlMutation,
    injectHtmlDependency,
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
  const dependencyUrls = []
  const importMetaHotAcceptDependencies = []
  htmlDependencies.forEach(({ specifier }) => {
    const ressourceUrl = ressourceGraph.applyUrlResolution(specifier, url)
    dependencyUrls.push(ressourceUrl)
    // adding url to "dependencyUrls" means html uses an url
    // and should reload (hot or full) when an url changes.
    // Adding url to "importMetaHotAcceptDependencies" means html hot_reload these ressources:
    // something like this: link.href = `${link.href}?hmr=${Date.now()}`)
    // If some url must trigger a full reload of the html page it should be excluded from
    // "importMetaHotAcceptDependencies". For now it seems it's ok to hot reload everything
    importMetaHotAcceptDependencies.push(ressourceUrl)
  })
  ressourceGraph.updateRessourceDependencies({
    url,
    type: "html",
    dependencyUrls,
    importMetaHotAcceptSelf: false,
    importMetaHotAcceptDependencies,
  })
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
// also remove integrity attributes because we don't know in advance
// the result of the file compilation
const visitRessourceHints = async ({ ressourceHints, addHtmlMutation }) => {
  await Promise.all(
    ressourceHints.map(async (ressourceHint) => {
      const hrefAttribute = getHtmlNodeAttributeByName(ressourceHint, "href")
      const href = hrefAttribute ? hrefAttribute.value : ""
      if (!href) {
        return
      }
      const integrityAttribute = getHtmlNodeAttributeByName(
        ressourceHint,
        "integrity",
      )
      if (integrityAttribute) {
        addHtmlMutation(() => {
          removeHtmlNodeAttribute(ressourceHint, integrityAttribute)
        })
      }
      const relAttribute = getHtmlNodeAttributeByName(ressourceHint, "rel")
      const asAttribute = getHtmlNodeAttributeByName(ressourceHint, "as")
      // - "modulepreload" -> "preload" because it's now regular js script
      if (ressourceHint.rel === "modulepreload") {
        addHtmlMutation(() => {
          relAttribute.value = "preload"
          if (asAttribute) {
            asAttribute.value = "script"
          } else {
            addHtmlNodeAttribute(ressourceHint, { name: "as", value: "script" })
          }
        })
        return
      }
      // if (asAttribute && asAttribute.value === "script") {
      //   addHtmlMutation(() => {
      //     replaceHtmlNode(htmlNode, `<link as="script" />`)
      //   })
      //   return
      // }
    }),
  )
}

const visitImportmapScripts = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  url,
  compiledUrl,

  compileProfile,

  htmlAst,
  scripts,
  addHtmlMutation,
  addHtmlSourceFile,
  onHtmlImportmapInfo,
}) => {
  const importmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    return type === "importmap"
  })
  const jsenvImportmap = getDefaultImportmap(compiledUrl, {
    projectDirectoryUrl,
    compileDirectoryUrl,
  })

  // in case there is no importmap, force the presence
  // so that '@jsenv/core/' are still remapped
  if (importmapScripts.length === 0) {
    const defaultImportMapAsText = JSON.stringify(jsenvImportmap, null, "  ")
    onHtmlImportmapInfo({
      url: compiledUrl,
      text: defaultImportMapAsText,
    })
    addHtmlMutation(() => {
      manipulateHtmlAst(htmlAst, {
        scriptInjections: [
          {
            type:
              compileProfile.moduleOutFormat === "systemjs"
                ? "systemjs-importmap"
                : "importmap",
            text: defaultImportMapAsText,
          },
        ],
      })
    })
    return
  }
  if (importmapScripts.length > 1) {
    logger.error("HTML file must contain max 1 importmap")
  }
  const firstImportmapScript = importmapScripts[0]
  const srcAttribute = getHtmlNodeAttributeByName(firstImportmapScript, "src")
  const src = srcAttribute ? srcAttribute.value : ""
  if (src) {
    const importmapUrl = resolveUrl(src, url)
    const importMapResponse = await fetchUrl(importmapUrl)
    let importmap
    if (importMapResponse.status === 200) {
      const importmapAsText = await importMapResponse.text()
      addHtmlSourceFile({
        url: importmapUrl,
        content: importmapAsText,
      })
      let htmlImportmap = JSON.parse(importmapAsText)
      importmap = moveImportMap(htmlImportmap, importmapUrl, url)
    } else {
      logger.warn(
        createDetailedMessage(
          importMapResponse.status === 404
            ? `importmap script file cannot be found.`
            : `importmap script file unexpected response status (${importMapResponse.status}).`,
          {
            "importmap url": importmapUrl,
            "html url": url,
          },
        ),
      )
      importmap = {}
    }
    importmap = composeTwoImportMaps(jsenvImportmap, importmap)
    const importmapAsText = JSON.stringify(importmap, null, "  ")
    onHtmlImportmapInfo({
      url: importmapUrl,
      text: importmapAsText,
    })
    addHtmlMutation(() => {
      removeHtmlNodeAttribute(firstImportmapScript, srcAttribute)
      setHtmlNodeText(firstImportmapScript, importmapAsText)
      if (compileProfile.moduleOutFormat === "systemjs") {
        const typeAttribute = getHtmlNodeAttributeByName(
          firstImportmapScript,
          "type",
        )
        typeAttribute.value = "systemjs-importmap"
      }
    })
    return
  }

  const htmlImportmap = JSON.parse(
    getHtmlNodeTextNode(firstImportmapScript).value,
  )
  const importmap = composeTwoImportMaps(jsenvImportmap, htmlImportmap)
  const importmapAsText = JSON.stringify(importmap, null, "  ")
  onHtmlImportmapInfo({
    url: compiledUrl,
    text: importmapAsText,
  })
  addHtmlMutation(() => {
    removeHtmlNodeAttribute(firstImportmapScript, srcAttribute)
    setHtmlNodeText(firstImportmapScript, importmapAsText)
    if (compileProfile.moduleOutFormat === "systemjs") {
      const typeAttribute = getHtmlNodeAttributeByName(
        firstImportmapScript,
        "type",
      )
      typeAttribute.value = "systemjs-importmap"
    }
  })
  return
}

const visitScripts = async ({
  logger,
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  compileServerOrigin,
  url,
  compiledUrl,

  compileProfile,
  babelPluginMap,
  topLevelAwait,
  sourcemapMethod,

  scripts,
  addHtmlSourceFile,
  addHtmlAssetGenerator,
  addHtmlMutation,
  injectHtmlDependency,
}) => {
  scripts.forEach((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    const integrityAttribute = getHtmlNodeAttributeByName(script, "integrity")
    const textNode = getHtmlNodeTextNode(script)
    if (type === "module") {
      const dataJsenvAttribute = getHtmlNodeAttributeByName(
        script,
        "data-jsenv",
      )
      if (dataJsenvAttribute) {
        return
      }

      if (src) {
        addHtmlMutation(() => {
          if (compileProfile.moduleOutFormat === "systemjs") {
            removeHtmlNodeAttribute(script, typeAttribute)
          }
          if (integrityAttribute) {
            removeHtmlNodeAttribute(script, integrityAttribute)
          }
          removeHtmlNodeAttribute(script, srcAttribute)
          const jsenvMethod =
            compileProfile.moduleOutFormat === "systemjs"
              ? "executeFileUsingSystemJs"
              : "executeFileUsingDynamicImport"
          let specifier
          if (
            jsenvRemoteDirectory.isRemoteUrl(src) &&
            !jsenvRemoteDirectory.isPreservedUrl(src)
          ) {
            const fileUrl = jsenvRemoteDirectory.fileUrlFromRemoteUrl(src)
            const fileUrlRelativeToHtml = urlToRelativeUrl(fileUrl, url)
            specifier = `./${fileUrlRelativeToHtml}`
          } else {
            specifier = src
          }
          setHtmlNodeText(
            script,
            `window.__jsenv__.${jsenvMethod}(${JSON.stringify(specifier)})`,
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
          jsenvRemoteDirectory,
          url: scriptOriginalUrl,
          compiledUrl: scriptCompiledUrl,

          type: "module",
          compileProfile,
          babelPluginMap,
          topLevelAwait,

          sourcemapMethod,
          code: textNode.value,
        })
      })
      const specifier = `./${urlToRelativeUrl(scriptCompiledUrl, compiledUrl)}`
      addHtmlMutation(() => {
        if (compileProfile.moduleOutFormat === "systemjs") {
          removeHtmlNodeAttribute(script, typeAttribute)
        }
        removeHtmlNodeAttribute(script, srcAttribute)
        const jsenvMethod =
          compileProfile.moduleOutFormat === "systemjs"
            ? "executeFileUsingSystemJs"
            : "executeFileUsingDynamicImport"
        setHtmlNodeText(
          script,
          `window.__jsenv__.${jsenvMethod}(${JSON.stringify(specifier)})`,
        )
      })
      injectHtmlDependency({
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
        const isRemoteUrl = jsenvRemoteDirectory.isRemoteUrl(src)
        if (isRemoteUrl && jsenvRemoteDirectory.isPreservedUrl(src)) {
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
          // we could take into account the integrity her
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
            jsenvRemoteDirectory,
            url: scriptOriginalUrl,
            compiledUrl: scriptCompiledUrl,

            type: "classic",
            compileProfile,
            babelPluginMap,
            topLevelAwait,

            sourcemapMethod,
            code: scriptAsText,
          })
        })
        addHtmlMutation(() => {
          if (integrityAttribute) {
            removeHtmlNodeAttribute(script, integrityAttribute)
          }
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
          jsenvRemoteDirectory,
          url: scriptOriginalUrl,
          compiledUrl: scriptCompiledUrl,

          type: "classic",
          compileProfile,
          babelPluginMap,
          topLevelAwait,

          code: textNode.value,
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
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  type,
  compileProfile,
  babelPluginMap,
  topLevelAwait,

  code,
  sourcemapMethod,
}) => {
  let transformResult
  try {
    transformResult = await transformJs({
      projectDirectoryUrl,
      jsenvRemoteDirectory,
      url,
      compiledUrl,

      babelPluginMap,
      moduleOutFormat:
        type === "module" ? compileProfile.moduleOutFormat : "global",
      topLevelAwait: type === "module" ? topLevelAwait : false,
      babelHelpersInjectionAsImport: type === "module" ? undefined : false,

      code,
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

const collectRessourceHints = (htmlAst) => {
  const ressourceHints = []
  visitHtmlAst(htmlAst, (htmlNode) => {
    if (htmlNode.nodeName !== "link") {
      return
    }
    const relAttribute = getHtmlNodeAttributeByName(htmlNode, "rel")
    const rel = relAttribute ? relAttribute.value : ""
    const isRessourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(rel)
    if (!isRessourceHint) {
      return
    }
    ressourceHints.push(htmlNode)
  })
  return ressourceHints
}
