import { resolveUrl } from "@jsenv/filesystem"
import { moveImportMap, composeTwoImportMaps } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"
import {
  injectBeforeFirstHeadScript,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  removeHtmlNodeAttribute,
  setHtmlNodeText,
  createHtmlNode,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import_resolution/importmap_default.js"

export const mutateImportmapScripts = async ({
  logger,
  projectDirectoryUrl,
  compileDirectoryUrl,
  url,
  canUseScriptTypeImportmap,
  htmlAst,
  scripts,
}) => {
  const importmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    return type === "importmap"
  })
  const importmapFromJsenv = getDefaultImportmap(url, {
    projectDirectoryUrl,
    compileDirectoryUrl,
  })
  // in case there is no importmap, force the presence
  // so that "@jsenv/core/" are still remapped
  if (importmapScripts.length === 0) {
    const importmapAsText = JSON.stringify(importmapFromJsenv, null, "  ")
    injectBeforeFirstHeadScript(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        type: canUseScriptTypeImportmap ? "importmap" : "systemjs-importmap",
        textContent: importmapAsText,
      }),
    )
    return {
      url: null,
      sourceText: null,
      text: importmapAsText,
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
    const importmapResponse = await fetchUrl(importmapUrl)
    let sourceText
    let importmapFromHtml
    if (importmapResponse.status === 200) {
      sourceText = await importmapResponse.text()
      importmapFromHtml = JSON.parse(sourceText)
      importmapFromHtml = moveImportMap(importmapFromHtml, importmapUrl, url)
    } else {
      sourceText = null
      importmapFromHtml = {}
      logger.warn(
        createDetailedMessage(
          importmapResponse.status === 404
            ? `importmap script file cannot be found.`
            : `importmap script file unexpected response status (${importmapResponse.status}).`,
          {
            "importmap url": importmapUrl,
            "html url": url,
          },
        ),
      )
    }
    const importmap = composeTwoImportMaps(
      importmapFromJsenv,
      importmapFromHtml,
    )
    const importmapAsText = JSON.stringify(importmap, null, "  ")
    removeHtmlNodeAttribute(firstImportmapScript, srcAttribute)
    setHtmlNodeText(firstImportmapScript, importmapAsText)
    if (!canUseScriptTypeImportmap) {
      const typeAttribute = getHtmlNodeAttributeByName(
        firstImportmapScript,
        "type",
      )
      typeAttribute.value = "systemjs-importmap"
    }
    return {
      url: importmapUrl,
      sourceText,
      text: importmapAsText,
    }
  }
  const sourceText = getHtmlNodeTextNode(firstImportmapScript).value
  const importmapFromHtml = JSON.parse(sourceText)
  const importmap = composeTwoImportMaps(importmapFromJsenv, importmapFromHtml)
  const importmapAsText = JSON.stringify(importmap, null, "  ")
  removeHtmlNodeAttribute(firstImportmapScript, srcAttribute)
  setHtmlNodeText(firstImportmapScript, importmapAsText)
  if (!canUseScriptTypeImportmap) {
    const typeAttribute = getHtmlNodeAttributeByName(
      firstImportmapScript,
      "type",
    )
    typeAttribute.value = "systemjs-importmap"
  }
  return {
    url: null,
    sourceText,
    text: importmapAsText,
  }
}
