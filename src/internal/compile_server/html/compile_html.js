import { resolveUrl, urlToFilename } from "@jsenv/filesystem"

import {
  injectBeforeFirstHeadScript,
  parseHtmlString,
  parseHtmlAstRessources,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttribute,
  visitHtmlAst,
  assignHtmlNodeAttributes,
  removeHtmlNodeAttributeByName,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { mutateImportmapScripts } from "@jsenv/core/src/internal/transform_importmap/importmap_mutation.js"
import { superviseScripts } from "@jsenv/core/src/internal/html_supervisor/supervise_scripts.js"
import { getScriptsToInject } from "@jsenv/core/src/internal/transform_html/html_script_injection.js"
import {
  collectHtmlUrlMentions,
  updateHtmlHotMeta,
} from "@jsenv/core/src/internal/autoreload/hot_html.js"

import { compileJavascript } from "../js/compile_js.js"

export const compileHtml = async ({
  // cancellationToken,
  logger,
  projectDirectoryUrl,
  ressourceGraph,
  jsenvFileSelector,
  jsenvRemoteDirectory,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,

  compileProfile,
  compileId,
  babelPluginMap,
  topLevelAwait,
  importMetaHot,

  eventSourceClient,
  htmlSupervisor,
  toolbar,

  sourcemapMethod,
  content,
}) => {
  const compileDirectoryUrl = `${projectDirectoryUrl}${jsenvDirectoryRelativeUrl}${compileId}/`
  // ideally we should try/catch html syntax error
  const htmlAst = parseHtmlString(content)
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
  addHtmlSourceFile({ url, content })

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
    htmlContent: content,
  })
  supervisedScripts.forEach(({ script, type, textContent, inlineSrc }) => {
    if (type === "module" && !canUseScriptTypeModule) {
      removeHtmlNodeAttributeByName(script, "type")
    }
    if (inlineSrc) {
      const inlineScriptSourceUrl = resolveUrl(inlineSrc, url)
      const inlineScriptCompiledUrl = resolveUrl(inlineSrc, compiledUrl)
      addHtmlAssetGenerator(async () => {
        return transformHtmlScript({
          projectDirectoryUrl,
          ressourceGraph,
          jsenvRemoteDirectory,
          url: inlineScriptSourceUrl,
          compiledUrl: inlineScriptCompiledUrl,
          isInline: true,

          type: type === "module" ? "module" : "script",
          compileProfile,
          babelPluginMap,
          topLevelAwait,
          importMetaHot,

          sourcemapMethod,
          content: textContent,
        })
      })
    }
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
  const urlMentions = collectHtmlUrlMentions(htmlAst, compiledUrl)
  const dependencyUrls = updateHtmlHotMeta({
    ressourceGraph,
    url,
    urlMentions,
  })
  return {
    contentType: "text/html",
    content: htmlAfterTransformation,
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
            assignHtmlNodeAttributes(ressourceHint, { as: "script" })
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

const transformHtmlScript = async ({
  projectDirectoryUrl,
  ressourceGraph,
  jsenvRemoteDirectory,
  url,
  compiledUrl,
  isInline,

  type,
  compileProfile,
  babelPluginMap,
  topLevelAwait,
  importMetaHot,

  sourcemapMethod,
  content,
}) => {
  try {
    const compileResult = await compileJavascript({
      projectDirectoryUrl,
      ressourceGraph,
      jsenvRemoteDirectory,
      url,
      compiledUrl,

      type,
      compileProfile,
      babelPluginMap,
      topLevelAwait,
      importMetaHot,

      sourcemapMethod,
      content,
    })
    content = compileResult.content
    const files = []
    files.push({
      url: compiledUrl,
      content,
    })
    compileResult.assets.forEach((url, index) => {
      files.push({
        url,
        content: compileResult.assetsContent[index],
      })
    })
    return files
  } catch (e) {
    // If there is a syntax error in inline script
    // we put the raw script without transformation.
    // when systemjs will try to instantiate to script it
    // will re-throw this syntax error.
    // Thanks to this we see the syntax error in the
    // document and autoreload still works
    // because we gracefully handle this error
    if (e.code === "PARSE_ERROR") {
      return [
        {
          // inline script do actually exists on the filesystem
          url: isInline ? compiledUrl : url,
          content,
        },
      ]
    }
    throw e
  }
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
