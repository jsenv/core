import { parseMultipleHeader } from "../internal/multiple-header.js"
import { applyContentNegotiation } from "./applyContentNegotiation.js"

export const negotiateContentLanguage = (request, availableLanguages) => {
  const { headers = {} } = request
  const requestAcceptLanguageHeader = headers["accept-language"]
  if (!requestAcceptLanguageHeader) {
    return null
  }

  const languagesAccepted = parseAcceptLanguageHeader(
    requestAcceptLanguageHeader,
  )
  return applyContentNegotiation({
    accepteds: languagesAccepted,
    availables: availableLanguages,
    getAcceptanceScore: getLanguageAcceptanceScore,
  })
}

const parseAcceptLanguageHeader = (acceptLanguageHeaderString) => {
  const acceptLanguageHeader = parseMultipleHeader(acceptLanguageHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q"
    },
  })

  const languagesAccepted = []
  Object.keys(acceptLanguageHeader).forEach((key) => {
    const { q = 1 } = acceptLanguageHeader[key]
    const value = key
    languagesAccepted.push({
      value,
      quality: q,
    })
  })
  languagesAccepted.sort((a, b) => {
    return b.quality - a.quality
  })
  return languagesAccepted
}

const getLanguageAcceptanceScore = ({ value, quality }, availableLanguage) => {
  const [acceptedPrimary, acceptedVariant] = decomposeLanguage(value)
  const [availablePrimary, availableVariant] =
    decomposeLanguage(availableLanguage)

  const primaryAccepted =
    acceptedPrimary === "*" ||
    acceptedPrimary.toLowerCase() === availablePrimary.toLowerCase()
  const variantAccepted =
    acceptedVariant === "*" || compareVariant(acceptedVariant, availableVariant)

  if (primaryAccepted && variantAccepted) {
    return quality + 1
  }
  if (primaryAccepted) {
    return quality
  }
  return -1
}

const decomposeLanguage = (fullType) => {
  const [primary, variant] = fullType.split("-")
  return [primary, variant]
}

const compareVariant = (left, right) => {
  if (left === right) {
    return true
  }
  if (left && right && left.toLowerCase() === right.toLowerCase()) {
    return true
  }
  return false
}
