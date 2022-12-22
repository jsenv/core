import { assertUrlLike } from "./assertions.js"

export const resolveAssociations = (associations, baseUrl) => {
  assertUrlLike(baseUrl, "baseUrl")
  const associationsResolved = {}
  Object.keys(associations).forEach((key) => {
    const valueMap = associations[key]
    const valueMapResolved = {}
    Object.keys(valueMap).forEach((pattern) => {
      const value = valueMap[pattern]
      const patternResolved = normalizeUrlPattern(pattern, baseUrl)
      valueMapResolved[patternResolved] = value
    })
    associationsResolved[key] = valueMapResolved
  })
  return associationsResolved
}

const normalizeUrlPattern = (urlPattern, baseUrl) => {
  try {
    return String(new URL(urlPattern, baseUrl))
  } catch (e) {
    // it's not really an url, no need to perform url resolution nor encoding
    return urlPattern
  }
}
