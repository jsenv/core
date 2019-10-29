import { pathToFileURL, fileURLToPath } from "url"
import { resolve } from "path"

export const resolvePath = (specifier, basePath) => {
  return resolve(specifier, basePath)
}

export const pathToDirectoryUrl = (path) => {
  const directoryUrl = path.startsWith("file://") ? path : String(pathToFileURL(path))
  if (directoryUrl.endsWith("/")) {
    return directoryUrl
  }
  return `${directoryUrl}/`
}

export const pathToFileUrl = (path) => {
  return pathToFileURL(path)
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
  if (fileUrl.startsWith(baseUrl)) {
    return `./${fileUrl.slice(baseUrl.length)}`
  }
  return fileUrl
}

export const resolveFileUrl = (specifier, baseUrl) => {
  return String(new URL(specifier, baseUrl))
}
