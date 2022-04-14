import { extname } from "node:path"

import { mediaTypeInfos } from "./media_type_infos.js"

export const ContentType = {
  parse: (string) => {
    const [mediaType, charset] = string.split(";")
    return { mediaType: normalizeMediaType(mediaType), charset }
  },

  stringify: ({ mediaType, charset }) => {
    if (charset) {
      return `${mediaType};${charset}`
    }
    return mediaType
  },

  asMediaType: (value) => {
    if (typeof value === "string") {
      return ContentType.parse(value).mediaType
    }
    if (typeof value === "object") {
      return value.mediaType
    }
    return null
  },

  isTextual: (value) => {
    const mediaType = ContentType.asMediaType(value)
    if (mediaType.startsWith("text/")) {
      return true
    }
    const mediaTypeInfo = mediaTypeInfos[mediaType]
    if (mediaTypeInfo && mediaTypeInfo.isTextual) {
      return true
    }
    // catch things like application/manifest+json, application/importmap+json
    if (/^application\/\w+\+json$/.test(mediaType)) {
      return true
    }
    return false
  },

  asFileExtension: (value) => {
    const mediaType = ContentType.asMediaType(value)
    const mediaTypeInfo = mediaTypeInfos[mediaType]
    return mediaTypeInfo ? mediaTypeInfo.extensions[0] : ""
  },

  fromUrl: (url) => {
    const { pathname } = new URL(url)
    const extensionWithDot = extname(pathname)
    if (!extensionWithDot || extensionWithDot === ".") {
      return "application/octet-stream"
    }
    const extension = extensionWithDot.slice(1)
    const mediaTypeFound = Object.keys(mediaTypeInfos).find((mediaType) => {
      const mediaTypeInfo = mediaTypeInfos[mediaType]
      return (
        mediaTypeInfo.extensions && mediaTypeInfo.extensions.includes(extension)
      )
    })
    return mediaTypeFound || "application/octet-stream"
  },
}

const normalizeMediaType = (value) => {
  if (value === "application/javascript") {
    return "text/javascript"
  }
  return value
}
