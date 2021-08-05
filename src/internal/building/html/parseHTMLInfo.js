import {
  findNodes,
  htmlNodeIsScriptImportmap,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

export const importMapInfosFromHtml = (htmlSource) => {
  const importMapHtmlNodes = findNodes(htmlSource, htmlNodeIsScriptImportmap)
  const infos = []
  importMapHtmlNodes.forEach((importMapHtmlNode) => {
    const srcAttribute = getHtmlNodeAttributeByName(importMapHtmlNode, "src")
    if (srcAttribute) {
      infos.push({
        type: "remote",
        importMapHtmlNode,
        importMapSrc: srcAttribute.value,
      })
      return
    }

    const textNode = getHtmlNodeTextNode(importMapHtmlNode)
    if (textNode) {
      infos.push({
        type: "inline",
        importMapHtmlNode,
        importMapTextNode: textNode,
      })
    }
  })
  return infos
}
