import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  resolveUrl,
} from "@jsenv/filesystem"

// use a fake and predictable compile server origin
// because rollup will check the dependencies url
// when computing the file hash
// https://github.com/rollup/rollup/blob/d6131378f9481a442aeaa6d4e608faf3303366dc/src/Chunk.ts#L483
// this way file hash remains the same when file content does not change
const STATIC_COMPILE_SERVER_AUTHORITY = "//jsenv.com"

export const createUrlConverter = ({
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  urlMappings,
}) => {
  const compileServerOriginForRollup = String(
    new URL(STATIC_COMPILE_SERVER_AUTHORITY, compileServerOrigin),
  ).slice(0, -1)
  urlMappings = normalizeUrlMappings(urlMappings, projectDirectoryUrl)
  const mappingsRevertMap = {}

  const asRollupUrl = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${compileServerOriginForRollup}/${url.slice(
        `${compileServerOrigin}/`.length,
      )}`
    }
    return url
  }

  const asProjectUrl = (url) => {
    return projectUrlFromUrl(asServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
    })
  }

  const asServerUrl = (url) => {
    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${compileServerOrigin}/${url.slice(
        `${compileServerOriginForRollup}/`.length,
      )}`
    }
    return serverUrlFromUrl(url, { projectDirectoryUrl, compileServerOrigin })
  }

  const asCompiledUrl = (url) => {
    const projectCompiledUrl = compiledProjectUrlFromUrl(
      asProjectUrl(url) || url,
      {
        projectDirectoryUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      },
    )
    return projectCompiledUrl
  }

  const asCompiledServerUrl = (url) => {
    const projectCompiledUrl = asCompiledUrl(url)
    return asServerUrl(projectCompiledUrl)
  }

  const asOriginalUrl = (url) => {
    const projectOriginalUrl = originalProjectUrlFromUrl(
      asProjectUrl(url) || url,
      {
        projectDirectoryUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      },
    )
    const withoutMapping = mappingsRevertMap[projectOriginalUrl]
    return withoutMapping || projectOriginalUrl
  }

  const asOriginalServerUrl = (url) => {
    const projectOriginalUrl = asOriginalUrl(url)
    return projectOriginalUrl ? asServerUrl(projectOriginalUrl) : null
  }

  // Url can
  // - come from rollup "load" hook and be compiled
  // - come from rollup "load" hook and be the original url
  // - come from asset builder and be compiled
  // - come from asset builder and be the original url
  // We first want to ensure we are talking about the same url
  // so we get the originalProjectUrl
  // then we should return a mapped url, keeping in mind that
  // if the url was compiled it should remain compiled
  const applyUrlMappings = (url) => {
    const originalProjectUrl = asOriginalUrl(url)
    const urlMapping = urlMappings[originalProjectUrl]
    if (!urlMapping) {
      return url
    }

    mappingsRevertMap[urlMapping] = originalProjectUrl
    const isInsideProject =
      url === projectDirectoryUrl || urlIsInsideOf(url, projectDirectoryUrl)
    const projectUrl = isInsideProject ? url : asProjectUrl(url)
    const compileDirectoryUrl = resolveUrl(
      compileDirectoryRelativeUrl,
      projectDirectoryUrl,
    )
    const isCompiled =
      projectUrl === compileDirectoryUrl ||
      urlIsInsideOf(projectUrl, compileDirectoryUrl)
    if (isCompiled && isInsideProject) {
      return asCompiledUrl(urlMapping)
    }
    if (isCompiled) {
      return asCompiledServerUrl(urlMapping)
    }
    if (isInsideProject) {
      return asProjectUrl(urlMapping)
    }
    return asServerUrl(urlMapping)
  }

  return {
    asRollupUrl,
    asProjectUrl,
    asServerUrl,

    asCompiledUrl,
    asCompiledServerUrl,
    asOriginalUrl,
    asOriginalServerUrl,
    applyUrlMappings,
  }
}

const normalizeUrlMappings = (urlMappings, baseUrl) => {
  const urlMappingsNormalized = {}
  Object.keys(urlMappings).forEach((key) => {
    const value = urlMappings[key]
    const keyNormalized = resolveUrl(key, baseUrl)
    const valueNormalized = resolveUrl(value, baseUrl)
    urlMappingsNormalized[keyNormalized] = valueNormalized
  })
  return urlMappingsNormalized
}

export const serverUrlToCompileInfo = (
  url,
  { compileServerOrigin, outDirectoryRelativeUrl },
) => {
  const outDirectoryServerUrl = resolveDirectoryUrl(
    outDirectoryRelativeUrl,
    compileServerOrigin,
  )
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

// tries to convert an url into an url that is inside projectDirectoryUrl
const projectUrlFromUrl = (
  url,
  { projectDirectoryUrl, compileServerOrigin },
) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return url
  }

  const serverUrl = serverUrlFromUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin,
  })
  if (serverUrl) {
    return `${projectDirectoryUrl}${serverUrl.slice(
      `${compileServerOrigin}/`.length,
    )}`
  }

  return null
}

// tries to convert an url into an url that is inside compileServerOrigin
const serverUrlFromUrl = (
  url,
  { projectDirectoryUrl, compileServerOrigin },
) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return url
  }

  if (url.startsWith(projectDirectoryUrl)) {
    return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
  }

  return null
}

// tries to convert an url into an url inside compileServerOrigin
// AND return the compiled url is the url is the original version
const compiledProjectUrlFromUrl = (
  url,
  { projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  const projectUrl = projectUrlFromUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin,
  })
  if (!projectUrl) {
    return null
  }

  const compileDirectoryUrl = resolveUrl(
    compileDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  if (
    projectUrl === compileDirectoryUrl ||
    urlIsInsideOf(projectUrl, compileDirectoryUrl)
  ) {
    return projectUrl
  }

  const projectRelativeUrl = urlToRelativeUrl(projectUrl, projectDirectoryUrl)
  if (projectRelativeUrl) {
    return resolveUrl(projectRelativeUrl, compileDirectoryUrl)
  }

  return null
}

// tries to convert an url into an url that is inside projectDirectoryUrl
// AND return the original url if the url is the compiled version
const originalProjectUrlFromUrl = (
  url,
  {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileDirectoryRelativeUrl,
  },
) => {
  const projectUrl = projectUrlFromUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin,
  })
  if (!projectUrl) {
    return null
  }

  if (!compileDirectoryRelativeUrl) {
    const serverUrl = serverUrlFromUrl(projectUrl, {
      projectDirectoryUrl,
      compileServerOrigin,
    })
    compileDirectoryRelativeUrl = extractCompileDirectoryRelativeUrl({
      serverUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
    })
    if (!compileDirectoryRelativeUrl) {
      return projectUrl
    }
  }

  const compileDirectoryUrl = resolveUrl(
    compileDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  if (!urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
    return projectUrl
  }

  const relativeUrl = urlToRelativeUrl(projectUrl, compileDirectoryUrl)
  return resolveUrl(relativeUrl, projectDirectoryUrl)
}

const extractCompileDirectoryRelativeUrl = ({
  serverUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
}) => {
  const compileInfo = serverUrlToCompileInfo(serverUrl, {
    compileServerOrigin,
    outDirectoryRelativeUrl,
  })
  if (compileInfo.compiledId) {
    return `${outDirectoryRelativeUrl}${compileInfo.compileId}/`
  }
  return null
}
