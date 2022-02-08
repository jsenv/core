/**
 * Perform some/all the following modifications before serving html source files
 * - force inlining of importmap
 * - inject event source client
 * - inject html supervisor
 * - inject toolbar
 *
 * This allows to
 * - Fake remote importmap support
 * - Inject the event source client doing the autoreload (hmr or full reload)
 * - Know which script is throwing an error (allow to provide useful error messages and logs)
 * - Know when the whole HTML execution is done (mandatory for test execution)
 * - Have jsenv toolbar during dev which comes with some useful features
 */

import { resolveUrl, urlIsInsideOf } from "@jsenv/filesystem"

import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"
import { DataUrl } from "@jsenv/core/src/internal/data_url.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { mutateImportmapScripts } from "@jsenv/core/src/internal/transform_importmap/importmap_mutation.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
  injectBeforeFirstHeadScript,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import {
  inlineImg,
  inlineLinkStylesheet,
  inlineScript,
} from "@jsenv/core/src/internal/transform_html/html_inlining.js"
import { getScriptsToInject } from "@jsenv/core/src/internal/transform_html/html_script_injection.js"
import { superviseScripts } from "@jsenv/core/src/internal/html_supervisor/supervise_scripts.js"
import {
  collectHtmlUrlMentions,
  updateHtmlHotMeta,
} from "@jsenv/core/src/internal/autoreload/hot_html.js"

export const modifyHtml = async ({
  logger,
  projectDirectoryUrl,
  ressourceGraph,
  jsenvRemoteDirectory,
  jsenvFileSelector,

  preserveHtmlSourceFiles,
  eventSourceClient,
  htmlSupervisor,
  toolbar,
  autoreload,

  url,
  content,
}) => {
  url = urlWithoutSearch(url)
  const htmlAst = parseHtmlString(content)
  const { scripts } = parseHtmlAstRessources(htmlAst)
  const artifacts = []

  if (!preserveHtmlSourceFiles) {
    await mutateImportmapScripts({
      logger,
      projectDirectoryUrl,
      url,
      canUseScriptTypeImportmap: true,
      htmlAst,
      scripts,
    })
  }
  const isJsenvToolbar =
    url ===
    new URL("./src/internal/toolbar/toolbar.html", jsenvCoreDirectoryUrl).href
  if (isJsenvToolbar) {
    eventSourceClient = false
    htmlSupervisor = false
    toolbar = false
  }
  const scriptsToInject = getScriptsToInject({
    jsenvFileSelector,
    canUseScriptTypeModule: true,

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
  if (htmlSupervisor) {
    const supervisedScripts = superviseScripts({
      jsenvRemoteDirectory,
      jsenvFileSelector,
      url,
      canUseScriptTypeModule: true,
      scripts,
    })
    supervisedScripts.forEach(({ inlineSrc, textContent }) => {
      if (inlineSrc) {
        artifacts.push({
          specifier: inlineSrc,
          contentType: "application/javascript",
          content: textContent,
        })
      }
    })
  }
  if (!preserveHtmlSourceFiles) {
    await forceInlineRessources({
      logger,
      htmlAst,
      htmlFileUrl: url,
      projectDirectoryUrl,
    })
  }
  const htmlModified = stringifyHtmlAst(htmlAst)
  if (autoreload) {
    const urlMentions = collectHtmlUrlMentions(htmlAst)
    updateHtmlHotMeta({
      ressourceGraph,
      url,
      urlMentions,
    })
  }
  return {
    content: htmlModified,
    artifacts,
  }
}

const forceInlineRessources = async ({
  htmlAst,
  htmlFileUrl,
  projectDirectoryUrl,
}) => {
  const { scripts, links, imgs } = parseHtmlAstRessources(htmlAst)
  const inlineOperations = []
  scripts.forEach((script) => {
    const forceInlineAttribute = getJsenvForceInlineAttribute(script)
    if (!forceInlineAttribute) {
      return
    }
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    if (!src) {
      return
    }
    inlineOperations.push({
      specifier: src,
      mutateHtml: async (response) => {
        const textContent = await response.text()
        inlineScript(script, textContent)
      },
    })
  })
  links.forEach((link) => {
    const forceInlineAttribute = getJsenvForceInlineAttribute(link)
    if (!forceInlineAttribute) {
      return
    }
    const relAttribute = getHtmlNodeAttributeByName(link, "rel")
    const rel = relAttribute ? relAttribute.value : ""
    if (rel !== "stylesheet") {
      return
    }
    const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
    const href = hrefAttribute ? hrefAttribute.value : ""
    if (!href) {
      return
    }
    inlineOperations.push({
      specifier: href,
      mutateHtml: async (response) => {
        const textNode = await response.text()
        inlineLinkStylesheet(link, textNode)
      },
    })
  })
  imgs.forEach((img) => {
    const forceInlineAttribute = getJsenvForceInlineAttribute(img)
    if (!forceInlineAttribute) {
      return
    }
    const srcAttribute = getHtmlNodeAttributeByName(img, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    if (!src) {
      return
    }
    inlineOperations.push({
      specifier: src,
      mutateHtml: async (response) => {
        const responseArrayBuffer = await response.arrayBuffer()
        const responseAsBase64 = DataUrl.stringify({
          data: responseArrayBuffer,
          base64Flag: true,
          mediaType: response.headers["content-type"],
        })
        inlineImg(img, responseAsBase64)
      },
    })
  })

  await Promise.all(
    inlineOperations.map(async (inlineOperation) => {
      const url = resolveUrl(inlineOperation.specifier, htmlFileUrl)
      if (!urlIsInsideOf(url, projectDirectoryUrl)) {
        return
      }
      const response = await fetchUrl(url)
      if (response.status !== 200) {
        return
      }
      await inlineOperation.mutateHtml(response)
    }),
  )
}

const getJsenvForceInlineAttribute = (htmlNode) => {
  const jsenvForceInlineAttribute = getHtmlNodeAttributeByName(
    htmlNode,
    "data-jsenv-force-inline",
  )
  return jsenvForceInlineAttribute
}

const urlWithoutSearch = (url) => {
  const urlObject = new URL(url)
  urlObject.search = ""
  return urlObject.href
}
