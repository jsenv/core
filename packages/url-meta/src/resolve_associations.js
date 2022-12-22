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
  // starts with a scheme
  if (/^[a-zA-Z]{2,}:/.test(urlPattern)) {
    return new URL(urlPattern).href // to perform url encoding of url resource
  }
  return String(new URL(urlPattern, baseUrl))
}
