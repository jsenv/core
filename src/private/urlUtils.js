import { pathToFileURL, fileURLToPath } from "url"

export const pathToDirectoryUrl = (path) => {
  const directoryUrl = path.startsWith("file://") ? path : String(pathToFileURL(path))
  if (directoryUrl.endsWith("/")) {
    return directoryUrl
  }
  return `${directoryUrl}/`
}

export const pathToFileUrl = (path) => {
  return path.startsWith("file://") ? path : String(pathToFileURL(path))
}

export const fileUrlToPath = (fileUrl) => {
  return fileURLToPath(fileUrl)
}

export const resolveDirectoryUrl = (specifier, baseUrl) => {
  const directoryUrl = String(new URL(specifier, baseUrl))
  if (directoryUrl.endsWith("/")) {
    return directoryUrl
  }
  return `${directoryUrl}/`
}

export const hasScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
}

export const fileUrlToRelativePath = (fileUrl, baseUrl) => {
  if (typeof baseUrl !== "string") {
    throw new TypeError(`baseUrl must be a string, got ${baseUrl}`)
  }
  if (fileUrl.startsWith(baseUrl)) {
    return fileUrl.slice(baseUrl.length)
  }
  return fileUrl
}

export const resolveFileUrl = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing`)
  }
  return String(new URL(specifier, baseUrl))
}
