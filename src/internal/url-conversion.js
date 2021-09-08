import { resolveDirectoryUrl, urlToRelativeUrl, urlIsInsideOf, resolveUrl } from "@jsenv/filesystem"

export const urlToCompileInfo = (url, { compileServerOrigin, outDirectoryRelativeUrl }) => {
  const outDirectoryServerUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, compileServerOrigin)
  // not inside compile directory -> nothing to compile
  if (!url.startsWith(outDirectoryServerUrl)) {
    return { insideCompileDirectory: false }
  }

  const afterOutDirectory = url.slice(outDirectoryServerUrl.length)

  // serve files inside /.jsenv/out/* directly without compilation
  // this is just to allow some files to be written inside outDirectory and read directly
  // if asked by the client (such as env.json, groupMap.json, meta.json)
  if (!afterOutDirectory.includes("/") || afterOutDirectory[0] === "/") {
    return { insideCompileDirectory: true }
  }

  const parts = afterOutDirectory.split("/")
  const compileId = parts[0]
  // no compileId, we don't know what to compile (not supposed so happen)
  if (compileId === "") {
    return { insideCompileDirectory: true, compileId: null }
  }

  const afterCompileId = parts.slice(1).join("/")
  // note: afterCompileId can be '' (but not supposed to happen)
  return { insideCompileDirectory: true, compileId, afterCompileId }
}

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

export const urlToOriginalServerUrl = (
  url,
  {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileDirectoryRelativeUrl,
  },
) => {
  const originalProjectUrl = urlToOriginalProjectUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileDirectoryRelativeUrl,
  })
  if (!originalProjectUrl) {
    return null
  }

  return urlToServerUrl(originalProjectUrl, { projectDirectoryUrl, compileServerOrigin })
}

// take any url string and try to return a file url inside project directory url
// prefer the source url if the url is inside compile directory
export const urlToOriginalProjectUrl = (
  url,
  {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileDirectoryRelativeUrl,
  },
) => {
  const projectUrl = urlToProjectUrl(url, { projectDirectoryUrl, compileServerOrigin })
  if (!projectUrl) {
    return null
  }

  if (!compileDirectoryRelativeUrl) {
    compileDirectoryRelativeUrl = serverUrlToCompileDirectoryRelativeUrl(
      urlToServerUrl(projectUrl, { projectDirectoryUrl, compileServerOrigin }),
      { compileServerOrigin, outDirectoryRelativeUrl },
    )
    if (!compileDirectoryRelativeUrl) {
      return projectUrl
    }
  }

  const compileDirectoryUrl = resolveUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  if (!urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
    return projectUrl
  }

  const relativeUrl = urlToRelativeUrl(projectUrl, compileDirectoryUrl)
  return resolveUrl(relativeUrl, projectDirectoryUrl)
}

const serverUrlToCompileDirectoryRelativeUrl = (
  serverUrl,
  { compileServerOrigin, outDirectoryRelativeUrl },
) => {
  const compileInfo = urlToCompileInfo(serverUrl, { compileServerOrigin, outDirectoryRelativeUrl })
  if (compileInfo.compiledId) {
    return `${outDirectoryRelativeUrl}${compileInfo.compileId}/`
  }
  return null
}

export const urlToCompiledServerUrl = (
  url,
  { projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  const serverUrl = urlToServerUrl(url, { projectDirectoryUrl, compileServerOrigin })
  if (!serverUrl) {
    return null
  }

  const compileDirectoryServerUrl = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin)
  if (
    serverUrl === compileDirectoryServerUrl ||
    urlIsInsideOf(serverUrl, compileDirectoryServerUrl)
  ) {
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
