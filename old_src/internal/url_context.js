export const inferContextFrom = ({
  url,
  jsenvDirectoryRelativeUrl = ".jsenv/",
}) => {
  const { origin, pathname } = new URL(url)
  if (!pathname.startsWith(`/${jsenvDirectoryRelativeUrl}`)) {
    return {
      projectDirectoryServerUrl: `${origin}/`,
      jsenvDirectoryRelativeUrl: null,
      compileId: null,
      compileDirectoryRelativeUrl: null,
    }
  }
  const slashIndex = pathname.indexOf("/", 1)
  const afterJsenvDirectory = pathname.slice(slashIndex + 1)
  const nextSlashIndex = afterJsenvDirectory.indexOf("/")
  const compileId = afterJsenvDirectory.slice(0, nextSlashIndex)
  return {
    projectDirectoryServerUrl: `${origin}/`,
    jsenvDirectoryRelativeUrl,
    compileId,
    compileDirectoryRelativeUrl: `${jsenvDirectoryRelativeUrl}${compileId}/`,
  }
}

export const createUrlContext = ({
  projectDirectoryServerUrl,
  compileDirectoryRelativeUrl,
}) => {
  if (!compileDirectoryRelativeUrl) {
    const compileDirectoryServerUrl = `${projectDirectoryServerUrl}.jsenv/out/`
    return {
      asSourceRelativeUrl: (url) => {
        if (url.startsWith(projectDirectoryServerUrl)) {
          return url.slice(projectDirectoryServerUrl.length)
        }
        return url
      },
      asSourceUrl: (sourceRelativeUrl) => {
        return `${projectDirectoryServerUrl}${sourceRelativeUrl}`
      },
      asCompiledUrl: (sourceRelativeUrl) => {
        return `${compileDirectoryServerUrl}${sourceRelativeUrl}`
      },
      asUrlToFetch: (sourceRelativeUrl) => {
        return `${projectDirectoryServerUrl}${sourceRelativeUrl}`
      },
    }
  }
  const compileDirectoryServerUrl = `${projectDirectoryServerUrl}${compileDirectoryRelativeUrl}`
  return {
    asSourceRelativeUrl: (url) => {
      if (url.startsWith(compileDirectoryServerUrl)) {
        return url.slice(compileDirectoryServerUrl.length)
      }
      if (url.startsWith(projectDirectoryServerUrl)) {
        return url.slice(projectDirectoryServerUrl.length)
      }
      return url
    },
    asSourceUrl: (sourceRelativeUrl) => {
      return `${projectDirectoryServerUrl}${sourceRelativeUrl}`
    },
    asCompiledUrl: (sourceRelativeUrl) => {
      return `${compileDirectoryServerUrl}${sourceRelativeUrl}`
    },
    asUrlToFetch: (sourceRelativeUrl) => {
      return `${compileDirectoryServerUrl}${sourceRelativeUrl}`
    },
  }
}

export const getRessourceTrace = ({
  urlContext,
  url,
  importerUrl,
  type,
  notFound = false,
}) => {
  const namings = {
    js_module: {
      declaration: "import declared in",
      usage: "imported by",
    },
    js_script: {
      declaration: "referenced in",
      usage: "referenced by",
    },
    undefined: {
      declaration: "referenced in",
      usage: "referenced by",
    },
  }[type]
  if (notFound) {
    return {
      ...(importerUrl
        ? { [namings.declaration]: urlContext.asSourceRelativeUrl(importerUrl) }
        : {}),
      file: urlContext.asSourceRelativeUrl(url),
    }
  }
  return {
    file: urlContext.asSourceRelativeUrl(url),
    ...(importerUrl
      ? { [namings.usage]: urlContext.asSourceRelativeUrl(importerUrl) }
      : {}),
  }
}
