import { parseMultipleHeader } from "../internal/multiple-header.js"
import { applyContentNegotiation } from "./applyContentNegotiation.js"

export const negotiateContentType = (request, availableContentTypes) => {
  const { headers = {} } = request
  const requestAcceptHeader = headers.accept
  if (!requestAcceptHeader) {
    return null
  }

  const contentTypesAccepted = parseAcceptHeader(requestAcceptHeader)
  return applyContentNegotiation({
    accepteds: contentTypesAccepted,
    availables: availableContentTypes,
    getAcceptanceScore: getContentTypeAcceptanceScore,
  })
}

const parseAcceptHeader = (acceptHeader) => {
  const acceptHeaderObject = parseMultipleHeader(acceptHeader, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q"
    },
  })

  const accepts = []
  Object.keys(acceptHeaderObject).forEach((key) => {
    const { q = 1 } = acceptHeaderObject[key]
    const value = key
    accepts.push({
      value,
      quality: q,
    })
  })
  accepts.sort((a, b) => {
    return b.quality - a.quality
  })
  return accepts
}

const getContentTypeAcceptanceScore = (
  { value, quality },
  availableContentType,
) => {
  const [acceptedType, acceptedSubtype] = decomposeContentType(value)
  const [availableType, availableSubtype] =
    decomposeContentType(availableContentType)

  const typeAccepted = acceptedType === "*" || acceptedType === availableType
  const subtypeAccepted =
    acceptedSubtype === "*" || acceptedSubtype === availableSubtype

  if (typeAccepted && subtypeAccepted) {
    return quality
  }
  return -1
}

const decomposeContentType = (fullType) => {
  const [type, subtype] = fullType.split("/")
  return [type, subtype]
}
