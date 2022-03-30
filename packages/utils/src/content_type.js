export const ContentType = {
  parse: (string) => {
    const [mediaType, charset] = string.split(";")
    return { mediaType, charset }
  },

  stringify: ({ mediaType, charset }) => {
    if (charset) {
      return `${mediaType};${charset}`
    }
    return mediaType
  },

  isTextual: (value) => {
    const { mediaType } =
      typeof value === "string" ? ContentType.parse(value) : value
    if (mediaType.startsWith("text/")) {
      return true
    }
    // catch things like application/manifest+json, application/importmap+json
    if (/^application\/\w+\+json$/.test(mediaType)) {
      return true
    }
    if (TEXTUAL_MEDIA_TYPES.includes(mediaType)) {
      return true
    }
    return false
  },
}

const TEXTUAL_MEDIA_TYPES = [
  "application/javascript",
  "application/json",
  "image/svg+xml",
]
