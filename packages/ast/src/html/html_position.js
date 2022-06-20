import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js"

export const storeHtmlNodePosition = (node) => {
  const originalPositionAttributeName = `original-position`
  const originalPosition = getHtmlNodeAttribute(
    node,
    originalPositionAttributeName,
  )
  if (originalPosition !== undefined) {
    return true
  }
  const { sourceCodeLocation } = node
  if (!sourceCodeLocation) {
    return false
  }
  const { startLine, startCol, endLine, endCol } = sourceCodeLocation
  getHtmlNodeAttribute(node, {
    [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
  })
  return true
}
export const getHtmlNodePosition = (node, { preferOriginal = false } = {}) => {
  const position = {}
  const { sourceCodeLocation } = node
  if (sourceCodeLocation) {
    const { startLine, startCol, endLine, endCol } = sourceCodeLocation
    Object.assign(position, {
      line: startLine,
      lineEnd: endLine,
      column: startCol,
      columnEnd: endCol,
    })
  }
  const originalPosition = getHtmlNodeAttribute(node, "original-position")
  if (originalPosition === undefined) {
    return position
  }
  const [start, end] = originalPosition.split(";")
  const [originalLine, originalColumn] = start.split(":")
  const [originalLineEnd, originalColumnEnd] = end.split(":")
  Object.assign(position, {
    originalLine: parseInt(originalLine),
    originalColumn: parseInt(originalColumn),
    originalLineEnd: parseInt(originalLineEnd),
    originalColumnEnd: parseInt(originalColumnEnd),
  })
  if (preferOriginal) {
    position.line = position.originalLine
    position.column = position.originalColumn
    position.lineEnd = position.originalLineEnd
    position.columnEnd = position.originalColumnEnd
    position.isOriginal = true
  }
  return position
}

export const storeHtmlAttributePosition = (node, attributeName) => {
  const { sourceCodeLocation } = node
  if (!sourceCodeLocation) {
    return false
  }
  const attributeValue = getHtmlNodeAttribute(node, attributeName)
  if (attributeValue === undefined) {
    return false
  }
  const attributeLocation = sourceCodeLocation.attrs[attributeName]
  if (!attributeLocation) {
    return false
  }
  const originalPositionAttributeName = `original-${attributeName}-position`
  const originalPosition = getHtmlNodeAttribute(
    node,
    originalPositionAttributeName,
  )
  if (originalPosition !== undefined) {
    return true
  }
  const { startLine, startCol, endLine, endCol } = attributeLocation
  setHtmlNodeAttributes(node, {
    [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
  })
  return true
}
export const getHtmlAttributePosition = (node, attributeName) => {
  const position = {}
  const { sourceCodeLocation } = node
  if (sourceCodeLocation) {
    const attributeLocation = sourceCodeLocation.attrs[attributeName]
    if (attributeLocation) {
      Object.assign(position, {
        line: attributeLocation.startLine,
        column: attributeLocation.startCol,
      })
    }
  }
  const originalPositionAttributeName =
    attributeName === "generated-from-src"
      ? "original-src-position"
      : attributeName === "generated-from-href"
      ? "original-href-position"
      : `original-${attributeName}-position`
  const originalPosition = getHtmlNodeAttribute(
    node,
    originalPositionAttributeName,
  )
  if (originalPosition === undefined) {
    return position
  }
  const [start, end] = originalPosition.split(";")
  const [originalLine, originalColumn] = start.split(":")
  const [originalLineEnd, originalColumnEnd] = end.split(":")
  Object.assign(position, {
    originalLine: parseInt(originalLine),
    originalColumn: parseInt(originalColumn),
    originalLineEnd: parseInt(originalLineEnd),
    originalColumnEnd: parseInt(originalColumnEnd),
  })
  return position
}
