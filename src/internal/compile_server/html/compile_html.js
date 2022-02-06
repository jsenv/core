import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { moveImportMap, composeTwoImportMaps } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import { superviseScripts } from "@jsenv/core/src/internal/html_supervisor/supervise_scripts.js"
import { getScriptsToInject } from "@jsenv/core/src/internal/transform_html/html_script_injection.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import_resolution/importmap_default.js"
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
  removeHtmlNodeAttribute,
  setHtmlNodeText,
  visitHtmlAst,
  addHtmlNodeAttribute,
  removeHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

export const compileHtml = async ({
  // cancellationToken,
  logger,
  projectDirectoryUrl,
  jsenvFileSelector,
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

  eventSourceClient,
  htmlSupervisor,
  toolbar,

  onHtmlImportmapInfo,

  sourcemapMethod,
  code,
}) => {
  const compileDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}${compileId}/`
  // ideally we should try/catch html syntax error
  const htmlAst = parseHtmlString(code)
  const scriptInjections = getScriptsToInject({
    jsenvFileSelector,
    canUseScriptTypeModule: compileProfile.moduleOutFormat === "esmodule",
    eventSourceClient,
    htmlSupervisor,
    toolbar,
  })
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
    jsenvFileSelector,
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
  projectDirectoryUrl,
  jsenvFileSelector,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  compileProfile,
  babelPluginMap,
  topLevelAwait,
  sourcemapMethod,

  scripts,
  addHtmlAssetGenerator,
  injectHtmlDependency,
}) => {
  const canUseScriptTypeModule = compileProfile.moduleOutFormat === "esmodule"
  const supervisedScripts = superviseScripts({
    jsenvRemoteDirectory,
    jsenvFileSelector,
    url: compiledUrl,
    canUseScriptTypeModule,
    scripts,
    generateInlineScriptSrc: (inlineScriptId) => {
      return `__asset__${inlineScriptId}.js`
    },
  })
  supervisedScripts.forEach(
    ({
      script,
      type,
      src,
      integrity,
      textContent,

      inlineScriptSrc,
    }) => {
      if (type === "module" && !canUseScriptTypeModule) {
        removeHtmlNodeAttributeByName(script, "type")
      }
      if (src && integrity) {
        removeHtmlNodeAttribute(script, "integrity")
      }
      if (inlineScriptSrc) {
        const inlineScriptOriginalUrl = resolveUrl(inlineScriptSrc, url)
        const inlineScriptCompiledUrl = resolveUrl(inlineScriptSrc, compiledUrl)
        addHtmlAssetGenerator(async () => {
          return transformHtmlScript({
            projectDirectoryUrl,
            jsenvRemoteDirectory,
            url: inlineScriptOriginalUrl,
            compiledUrl: inlineScriptCompiledUrl,

            type,
            compileProfile,
            babelPluginMap,
            topLevelAwait,

            sourcemapMethod,
            code: textContent,
          })
        })
        injectHtmlDependency({
          htmlNode: script,
          specifier: inlineScriptSrc,
        })
      }
    },
  )
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
