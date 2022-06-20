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
