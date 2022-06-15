import { applyPatternMatching } from "./pattern_matching.js"

export const applyAliases = ({ url, aliases }) => {
  let aliasFullMatchResult
  const aliasMatchingKey = Object.keys(aliases).find((key) => {
    const aliasMatchResult = applyPatternMatching({
      pattern: key,
      url,
    })
    if (aliasMatchResult.matched) {
      aliasFullMatchResult = aliasMatchResult
      return true
    }
    return false
  })
  if (!aliasMatchingKey) {
    return url
  }
  const { matchGroups } = aliasFullMatchResult
  const alias = aliases[aliasMatchingKey]
  const parts = alias.split("*")
  const newUrl = parts.reduce((previous, value, index) => {
    return `${previous}${value}${
      index === parts.length - 1 ? "" : matchGroups[index]
    }`
  }, "")
  return newUrl
}
