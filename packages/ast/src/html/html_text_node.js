import { setAttributes } from "./html_attributes.js"

export const getTextNode = (htmlNode) => {
  const firstChild = htmlNode.childNodes[0]
  return firstChild && firstChild.nodeName === "#text" ? firstChild : null
}

export const removeTextNode = (htmlNode) => {
  const textNode = getTextNode(htmlNode)
  if (textNode) {
    htmlNode.childNodes = []
  }
}

export const readTextNode = (textNode) => textNode.value

export const writeTextNode = (htmlNode, textContent) => {
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

export const writeGeneratedTextNode = (
  node,
  {
    generatedText,
    generatedBy,
    generatedFromSrc,
    generatedFromHref,
    generatedFromInlineContent,
  } = {},
) => {
  writeTextNode(node, generatedText)
  setAttributes(node, {
    "generated-by": generatedBy,
    ...(generatedFromSrc ? { "generated-from-src": generatedFromSrc } : {}),
    ...(generatedFromHref ? { "generated-from-href": generatedFromHref } : {}),
    ...(generatedFromInlineContent
      ? { "generated-from-inline-content": "" }
      : {}),
  })
}
