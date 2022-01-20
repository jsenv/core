import { isSupportedAlgorithm } from "./integrity_algorithms.js"

// see https://w3c.github.io/webappsec-subresource-integrity/#parse-metadata
export const parseIntegrity = (string) => {
  const integrityMetadata = {}
  string
    .trim()
    .split(/\s+/)
    .forEach((token) => {
      const { isValid, algo, base64Value, optionExpression } =
        parseAsHashWithOptions(token)
      if (!isValid) {
        return
      }
      if (!isSupportedAlgorithm(algo)) {
        return
      }
      const metadataList = integrityMetadata[algo]
      const metadata = { base64Value, optionExpression }
      integrityMetadata[algo] = metadataList
        ? [...metadataList, metadata]
        : [metadata]
    })
  return integrityMetadata
}

// see https://w3c.github.io/webappsec-subresource-integrity/#the-integrity-attribute
const parseAsHashWithOptions = (token) => {
  const dashIndex = token.indexOf("-")
  if (dashIndex === -1) {
    return { isValid: false }
  }
  const beforeDash = token.slice(0, dashIndex)
  const afterDash = token.slice(dashIndex + 1)
  const questionIndex = afterDash.indexOf("?")
  const algo = beforeDash
  if (questionIndex === -1) {
    const base64Value = afterDash
    const isValid = BASE64_REGEX.test(afterDash)
    return { isValid, algo, base64Value }
  }
  const base64Value = afterDash.slice(0, questionIndex)
  const optionExpression = afterDash.slice(questionIndex + 1)
  const isValid =
    BASE64_REGEX.test(afterDash) && VCHAR_REGEX.test(optionExpression)
  return { isValid, algo, base64Value, optionExpression }
}

const BASE64_REGEX = /^[A-Za-z0-9+\/=+]+$/
const VCHAR_REGEX = /^[\x21-\x7E]+$/
