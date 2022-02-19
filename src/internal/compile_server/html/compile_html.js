import {
  injectBeforeFirstHeadScript,
  parseHtmlString,
  parseHtmlAstRessources,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttribute,
  visitHtmlAst,
  assignHtmlNodeAttributes,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { mutateImportmapScripts } from "@jsenv/core/src/internal/transform_importmap/importmap_mutation.js"
import { superviseScripts } from "@jsenv/core/src/internal/html_supervisor/supervise_scripts.js"
import { getScriptsToInject } from "@jsenv/core/src/internal/transform_html/html_script_injection.js"
import {
  collectHtmlUrlMentions,
  updateHtmlHotMeta,
} from "@jsenv/core/src/internal/autoreload/hot_html.js"

import { generateCompilationAssetUrl } from "../jsenv_directory/compile_asset.js"

export const compileHtml = async ({
  // cancellationToken,
  logger,
  projectDirectoryUrl,
  ressourceGraph,
  sourceFileFetcher,
  jsenvFileSelector,
  jsenvDirectoryRelativeUrl,
  url,
  compiledUrl,

  compileProfile,
  compileId,

  eventSourceClient,
  htmlSupervisor,
  toolbar,

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

  const htmlMutations = []
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
  const { inlineRessources } = superviseScripts({
    sourceFileFetcher,
    jsenvFileSelector,
    url,
    canUseScriptTypeModule,
    htmlAst,
    htmlContent: content,
  })
  assets.push(
    generateCompilationAssetUrl(compiledUrl, "inline_ressources.json"),
  )
  assetsContent.push(JSON.stringify(inlineRessources, null, "  "))

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
