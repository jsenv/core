import { setHtmlNodeAttributes } from "./html_node_attributes.js"

export const getHtmlNodeText = (htmlNode) => {
  const textNode = getTextNode(htmlNode)
  return textNode ? textNode.value : undefined
}

const getTextNode = (htmlNode) => {
  const firstChild = htmlNode.childNodes[0]
  const textNode =
    firstChild && firstChild.nodeName === "#text" ? firstChild : null
  return textNode
}

export const removeHtmlNodeText = (htmlNode) => {
  const textNode = getTextNode(htmlNode)
  if (textNode) {
    htmlNode.childNodes = []
  }
}

export const setHtmlNodeText = (htmlNode, textContent) => {
  const textNode = getTextNode(htmlNode)
  if (textNode) {
    textNode.value = textContent
  } else {
    const newTextNode = {
      nodeName: "#text",
      value: textContent,
      parentNode: htmlNode,
    }
    htmlNode.childNodes.splice(0, 0, newTextNode)
  }
}

export const setHtmlNodeGeneratedText = (
  node,
  {
    generatedText,
    generatedBy,
    generatedFromSrc,
    generatedFromHref,
    generatedFromInlineContent,
  } = {},
) => {
  setHtmlNodeText(node, generatedText)
  setHtmlNodeAttributes(node, {
    "generated-by": generatedBy,
    ...(generatedFromSrc ? { "generated-from-src": generatedFromSrc } : {}),
    ...(generatedFromHref ? { "generated-from-href": generatedFromHref } : {}),
    ...(generatedFromInlineContent
      ? { "generated-from-inline-content": "" }
      : {}),
  })
}
