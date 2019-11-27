import { relative, dirname } from "path"
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

export const fileUrlToRelativePath = (fileUrl, baseFileUrl) => {
  // https://stackoverflow.com/a/31024574/2634179
  const fromPath = baseFileUrl.endsWith("/")
    ? fileUrlToPath(baseFileUrl)
    : dirname(fileUrlToPath(baseFileUrl))
  const toPath = fileUrlToPath(fileUrl)
  const relativePath = relative(fromPath, toPath)
  return relativePath
}

export const hasScheme = (string) => {
  return /^[a-zA-Z]{2,}:/.test(string)
}

export const urlToRelativeUrl = (url, baseUrl) => {
  if (typeof baseUrl !== "string") {
    throw new TypeError(`baseUrl must be a string, got ${baseUrl}`)
  }
  if (url.startsWith(baseUrl)) {
    // we should take into account only pathname
    // and ignore search params
    return url.slice(baseUrl.length)
  }
  return url
}

export const resolveUrl = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing`)
  }
  return String(new URL(specifier, baseUrl))
}

export const sameOrigin = (url, otherUrl) => {
  return new URL(url).origin === new URL(otherUrl).origin
}
