import { relative, dirname } from "path"
import { pathToFileURL, fileURLToPath } from "url"

export const directoryPathToUrl = (path) => {
  const directoryUrl = path.startsWith("file://") ? path : String(filePathToUrl(path))
  return ensureUrlTrailingSlash(directoryUrl)
}

export const ensureUrlTrailingSlash = (url) => {
  return url.endsWith("/") ? url : `${url}/`
}

export const filePathToUrl = (path) => {
  return path.startsWith("file://") ? path : String(pathToFileURL(path))
}

export const urlToFileSystemPath = (fileUrl) => {
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
    ? urlToFileSystemPath(baseFileUrl)
    : dirname(urlToFileSystemPath(baseFileUrl))
  const toPath = urlToFileSystemPath(fileUrl)
  const relativePath = relative(fromPath, toPath)

  return replaceBackSlashesWithSlashes(relativePath)
}

const replaceBackSlashesWithSlashes = (string) => string.replace(/\\/g, "/")

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
