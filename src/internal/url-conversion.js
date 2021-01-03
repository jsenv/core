import { urlToRelativeUrl, urlIsInsideOf, resolveUrl } from "@jsenv/util"

// take any url string and try to return a file url (an url inside projectDirectoryUrl)
export const urlToProjectUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return url
  }

  const serverUrl = urlToServerUrl(url, { projectDirectoryUrl, compileServerOrigin })
  if (serverUrl) {
    return `${projectDirectoryUrl}${serverUrl.slice(`${compileServerOrigin}/`.length)}`
  }

  return null
}

export const urlToProjectRelativeUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  const projectUrl = urlToProjectUrl(url, { projectDirectoryUrl, compileServerOrigin })
  if (!projectUrl) {
    return null
  }

  return urlToRelativeUrl(projectUrl, projectDirectoryUrl)
}

// take any url string and try to return the corresponding remote url (an url inside compileServerOrigin)
export const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return url
  }

  if (url.startsWith(projectDirectoryUrl)) {
    return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
  }

  return null
}

export const urlToOriginalServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  const originalProjectUrl = urlToOriginalProjectUrl(url)
  if (!originalProjectUrl) {
    return null
  }

  return urlToServerUrl(originalProjectUrl, { projectDirectoryUrl, compileServerOrigin })
}

// take any url string and try to return a file url inside project directory url
// prefer the source url if the url is inside compile directory
export const urlToOriginalProjectUrl = (
  url,
  { projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  const projectUrl = urlToProjectUrl(url, { projectDirectoryUrl, compileServerOrigin })
  if (!projectUrl) {
    return null
  }

  const compileDirectoryUrl = resolveUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  if (!urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
    return projectUrl
  }

  const relativeUrl = urlToRelativeUrl(projectUrl, compileDirectoryUrl)
  return resolveUrl(relativeUrl, projectDirectoryUrl)
}

export const urlToCompiledServerUrl = (
  url,
  { projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  const serverUrl = urlToServerUrl(url, { projectDirectoryUrl, compileServerOrigin })
  if (!serverUrl) {
    return null
  }

  const compileDirectoryServerUrl = resolveUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  if (urlIsInsideOf(serverUrl, compileDirectoryServerUrl)) {
    return serverUrl
  }

  const projectRelativeUrl = urlToProjectRelativeUrl(serverUrl, {
    projectDirectoryUrl,
    compileServerOrigin,
  })
  if (projectRelativeUrl) {
    return resolveUrl(projectRelativeUrl, compileDirectoryServerUrl)
  }

  return null
}
