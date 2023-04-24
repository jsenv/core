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
  const indentation = getIndentation(htmlNode)
  textContent = setIndentation(textContent, indentation)
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

const getIndentation = (htmlNode) => {
  const parentNode = htmlNode.parentNode
  if (!parentNode) {
    return ""
  }

  const siblings = parentNode.childNodes
  const index = siblings.indexOf(htmlNode)
  if (index === 0) {
    return ""
  }

  const previousSibling = siblings[index - 1]
  if (previousSibling.nodeName !== "#text") {
    return ""
  }

  const text = previousSibling.value
  const lines = text.split(/\r?\n/)
  const lastLine = lines[lines.length - 1]
  if (lastLine.match(/^[\t ]+$/)) {
    return lastLine
  }
  return ""
}

const setIndentation = (htmlNodeText, indentation) => {
  const contentIdentation = increaseIndentation(indentation, 2)
  const lines = htmlNodeText.trimEnd().split(/\r?\n/)
  let result = `\n`
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    i++
    result += `${contentIdentation}${line}\n`
  }
  result += `${indentation}`
  return result
}

const increaseIndentation = (indentation, size) => {
  const char = indentation[0]
  return char ? `${indentation}${char.repeat(size)}` : " ".repeat(size)
}
