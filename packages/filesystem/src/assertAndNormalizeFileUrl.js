import { isFileSystemPath } from "./isFileSystemPath.js"
import { fileSystemPathToUrl } from "./fileSystemPathToUrl.js"

export const assertAndNormalizeFileUrl = (value, baseUrl) => {
  let urlString

  if (value instanceof URL) {
    urlString = value.href
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value)
    } else {
      try {
        urlString = String(new URL(value, baseUrl))
      } catch (e) {
        throw new TypeError(`fileUrl must be a valid url, received ${value}`)
      }
    }
  } else {
    throw new TypeError(`fileUrl must be a string or an url, received ${value}`)
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`fileUrl must starts with file://, received ${value}`)
  }

  return urlString
}
