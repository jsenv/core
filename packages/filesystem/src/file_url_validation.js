import { fileSystemPathToUrl, isFileSystemPath } from "@jsenv/urls"

export const validateFileUrl = (value, baseUrl) => {
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
        return {
          valid: false,
          message: "must be a valid url",
        }
      }
    }
  } else {
    return {
      valid: false,
      message: "must be a string or an url",
    }
  }

  if (!urlString.startsWith("file://")) {
    return {
      valid: false,
      message: 'must start with "file://"',
    }
  }

  return {
    valid: true,
    value: urlString,
  }
}

export const assertAndNormalizeFileUrl = (fileUrl, baseUrl) => {
  const { valid, message, value } = validateFileUrl(fileUrl, baseUrl)
  if (!valid) {
    throw new TypeError(`invalid fileUrl: ${message}, received ${fileUrl}`)
  }
  return value
}
