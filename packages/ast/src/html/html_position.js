import { getAttributeByName, setAttributes } from "./html_attributes.js"

export const storeNodePosition = (node) => {
  const originalPositionAttributeName = `original-position`
  const originalPositionAttribute = getAttributeByName(
    node,
    originalPositionAttributeName,
  )
  if (originalPositionAttribute) {
    return true
  }
  const { sourceCodeLocation } = node
  if (!sourceCodeLocation) {
    return false
  }
  const { startLine, startCol, endLine, endCol } = sourceCodeLocation
  setAttributes(node, {
    [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
  })
  return true
}
export const getNodePosition = (node, { preferOriginal = false } = {}) => {
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
  const originalPositionAttribute = getAttributeByName(
    node,
    "original-position",
  )
  if (originalPositionAttribute) {
    const [start, end] = originalPositionAttribute.value.split(";")
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
  }
  return position
}

export const storeAttributePosition = (node, attributeName) => {
  const { sourceCodeLocation } = node
  if (!sourceCodeLocation) {
    return false
  }
  const attribute = getAttributeByName(node, attributeName)
  if (!attribute) {
    return false
  }
  const attributeLocation = sourceCodeLocation.attrs[attributeName]
  if (!attributeLocation) {
    return false
  }
  const originalPositionAttributeName = `original-${attributeName}-position`
  const originalPositionAttribute = getAttributeByName(
    node,
    originalPositionAttributeName,
  )
  if (originalPositionAttribute) {
    return true
  }
  const { startLine, startCol, endLine, endCol } = attributeLocation
  setAttributes(node, {
    [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
  })
  return true
}
export const getAttributePosition = (node, attributeName) => {
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
  const originalPositionAttribute = getAttributeByName(
    node,
    originalPositionAttributeName,
  )
  if (originalPositionAttribute) {
    const [start, end] = originalPositionAttribute.value.split(";")
    const [originalLine, originalColumn] = start.split(":")
    const [originalLineEnd, originalColumnEnd] = end.split(":")
    Object.assign(position, {
      originalLine: parseInt(originalLine),
      originalColumn: parseInt(originalColumn),
      originalLineEnd: parseInt(originalLineEnd),
      originalColumnEnd: parseInt(originalColumnEnd),
    })
  }
  return position
}
