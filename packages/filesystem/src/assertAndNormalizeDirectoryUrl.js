import {
  fileSystemPathToUrl,
  isFileSystemPath,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls"

export const assertAndNormalizeDirectoryUrl = (value) => {
  let urlString

  if (value instanceof URL) {
    urlString = value.href
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value)
    } else {
      try {
        urlString = String(new URL(value))
      } catch (e) {
        throw new TypeError(
          `directoryUrl must be a valid url, received ${value}`,
        )
      }
    }
  } else {
    throw new TypeError(
      `directoryUrl must be a string or an url, received ${value}`,
    )
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`directoryUrl must starts with file://, received ${value}`)
  }

  return ensurePathnameTrailingSlash(urlString)
}
