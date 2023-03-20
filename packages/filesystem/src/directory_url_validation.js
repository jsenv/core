import {
  fileSystemPathToUrl,
  isFileSystemPath,
  ensurePathnameTrailingSlash,
} from "@jsenv/urls"

export const validateDirectoryUrl = (value) => {
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
        return {
          valid: false,
          value,
          message: `must be a valid url`,
        }
      }
    }
  } else {
    return {
      valid: false,
      value,
      message: `must be a string or an url`,
    }
  }
  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      value,
      message: 'must start with "file://"',
    }
  }
  return {
    valid: true,
    value: ensurePathnameTrailingSlash(urlString),
  }
}

export const assertAndNormalizeDirectoryUrl = (directoryUrl) => {
  const { valid, message, value } = validateDirectoryUrl(directoryUrl)
  if (!valid) {
    throw new TypeError(`directoryUrl ${message}, got ${value}`)
  }
  return value
}
