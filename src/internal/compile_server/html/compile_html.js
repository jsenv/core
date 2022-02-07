import { resolveUrl, urlToRelativeUrl, urlToFilename } from "@jsenv/filesystem"

import { mutateImportmapScripts } from "@jsenv/core/src/internal/transform_importmap/importmap_mutation.js"
import { superviseScripts } from "@jsenv/core/src/internal/html_supervisor/supervise_scripts.js"
import { getScriptsToInject } from "@jsenv/core/src/internal/transform_html/html_script_injection.js"
import {
  generateSourcemapUrl,
  setJavaScriptSourceMappingUrl,
  sourcemapToBase64Url,
} from "@jsenv/core/src/internal/sourcemap_utils.js"
import { scanHtml } from "@jsenv/core/src/internal/hmr/scan_html.js"

import { transformJs } from "../js/js_transformer.js"
import {
  injectBeforeFirstHeadScript,
  parseHtmlString,
  parseHtmlAstRessources,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttribute,
  visitHtmlAst,
  addHtmlNodeAttribute,
  removeHtmlNodeAttributeByName,
  createHtmlNode,
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
  const scriptsToInject = getScriptsToInject({
    jsenvFileSelector,
    canUseScriptTypeModule: compileProfile.moduleOutFormat === "esmodule",
    eventSourceClient,
    htmlSupervisor,
    toolbar,
  })
  scriptsToInject.reverse().forEach((scriptToInject) => {
    injectBeforeFirstHeadScript(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        ...scriptToInject,
      }),
    )
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

  const htmlAssetGenerators = []
  const htmlMutations = []
  const addHtmlAssetGenerator = (htmlAssetGenerator) => {
    htmlAssetGenerators.push(htmlAssetGenerator)
  }
  const addHtmlMutation = (htmlMutation) => {
    htmlMutations.push(htmlMutation)
  }
  if (compileProfile.moduleOutFormat !== "esmodule") {
    const ressourceHints = collectRessourceHints(htmlAst)
    await visitRessourceHints({
      ressourceHints,
      addHtmlMutation,
    })
  }

  const importmapInfo = await mutateImportmapScripts({
    logger,
    projectDirectoryUrl,
    compileDirectoryUrl,
    url: compiledUrl,
    canUseScriptTypeImportmap: compileProfile.moduleOutFormat === "esmodule",
    htmlAst,
    scripts,
  })
  if (
    importmapInfo.url &&
    // indirect way of checking there was no 404 while fetching
    importmapInfo.sourceText
  ) {
    addHtmlSourceFile({
      url: importmapInfo.url,
      content: importmapInfo.sourceText,
    })
  }
  onHtmlImportmapInfo({
    url: importmapInfo.url || compiledUrl,
    text: importmapInfo.text,
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
  const dependencyUrls = scanHtml({
    url,
    html: htmlAfterTransformation,
    ressourceGraph,
  })
  return {
    contentType: "text/html",
    compiledSource: htmlAfterTransformation,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    dependencies: dependencyUrls,
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
}) => {
  const canUseScriptTypeModule = compileProfile.moduleOutFormat === "esmodule"
  const supervisedScripts = superviseScripts({
    jsenvRemoteDirectory,
    jsenvFileSelector,
    url: compiledUrl,
    canUseScriptTypeModule,
    scripts,
    generateSrcForInlineScript: (inlineScriptId) => {
      return `./${urlToFilename(url)}__asset__${inlineScriptId}.js`
    },
  })
  supervisedScripts.forEach(
    ({ script, type, src, integrity, textContent, inlineSrc }) => {
      if (type === "module" && !canUseScriptTypeModule) {
        removeHtmlNodeAttributeByName(script, "type")
      }
      if (src && integrity) {
        removeHtmlNodeAttribute(script, "integrity")
      }
      if (inlineSrc) {
        const inlineScriptOriginalUrl = resolveUrl(inlineSrc, url)
        const inlineScriptCompiledUrl = resolveUrl(inlineSrc, compiledUrl)
        addHtmlAssetGenerator(async () => {
          return transformHtmlScript({
            projectDirectoryUrl,
            jsenvRemoteDirectory,
            url: inlineScriptOriginalUrl,
            compiledUrl: inlineScriptCompiledUrl,
            isInline: true,

            type,
            compileProfile,
            babelPluginMap,
            topLevelAwait,

            sourcemapMethod,
            code: textContent,
          })
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
  isInline,

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
      return [
        {
          // inline script do actually exists on the filesystem
          url: isInline ? compiledUrl : url,
          content: code,
        },
      ]
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
