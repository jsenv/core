import {
  parseHtmlString,
  visitHtmlAst,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

export const importMapsFromHtml = (htmlSource) => {
  const importmaps = []
  const htmlAst = parseHtmlString(htmlSource)
  visitHtmlAst(htmlAst, (htmlNode) => {
    if (htmlNode.nodeName !== "script") {
      return
    }
    const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type")
    if (!typeAttribute) {
      return
    }

    const type = typeAttribute.value
    if (type !== "importmap") {
      return
    }

    const srcAttribute = getHtmlNodeAttributeByName(htmlNode, "src")
    if (srcAttribute) {
      importmaps.push({
        type: "remote",
        htmlNode,
        src: srcAttribute.value,
      })
      return
    }

    const textNode = getHtmlNodeTextNode(htmlNode)
    importmaps.push({
      type: "inline",
      htmlNode,
      text: textNode.value,
    })
  })
  return importmaps
}

export const preloadLinksFromHtml = (htmlSource) => {
  const preloadLinks = []
  const htmlAst = parseHtmlString(htmlSource)
  visitHtmlAst(htmlAst, (htmlNode) => {
    if (htmlNode.nodeName !== "link") {
      return
    }
    const relAttribute = getHtmlNodeAttributeByName(htmlNode, "rel")
    if (!relAttribute) {
      return
    }
    const relAttributeValue = relAttribute.value
    if (
      relAttributeValue !== "preload" &&
      relAttributeValue !== "modulepreload"
    ) {
      return
    }

    preloadLinks.push({
      htmlNode,
      rel: relAttributeValue,
    })
  })
  return preloadLinks
}
