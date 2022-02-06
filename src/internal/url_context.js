export const inferContextFrom = ({
  url,
  jsenvDirectoryRelativeUrl = ".jsenv/",
}) => {
  const { origin, pathname } = new URL(url)
  if (!pathname.startsWith(`/${jsenvDirectoryRelativeUrl}`)) {
    return {
      compileServerOrigin: origin,
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
    compileServerOrigin: origin,
    jsenvDirectoryRelativeUrl,
    compileId,
    compileDirectoryRelativeUrl: `${jsenvDirectoryRelativeUrl}${compileId}/`,
  }
}

export const createUrlContext = ({
  compileServerOrigin,
  compileDirectoryRelativeUrl,
}) => {
  if (!compileDirectoryRelativeUrl) {
    const compileDirectoryServerUrl = `${compileServerOrigin}/.jsenv/out/`
    return {
      asSourceRelativeUrl: (url) => {
        if (url.startsWith(compileServerOrigin)) {
          return url.slice(compileServerOrigin.length)
        }
        return url
      },
      asSourceUrl: (sourceRelativeUrl) => {
        return `${compileServerOrigin}${sourceRelativeUrl}`
      },
      asCompiledUrl: (sourceRelativeUrl) => {
        return `${compileDirectoryServerUrl}${sourceRelativeUrl}`
      },
      asUrlToFetch: (sourceRelativeUrl) => {
        return `${compileServerOrigin}${sourceRelativeUrl}`
      },
    }
  }
  const compileDirectoryServerUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}`
  return {
    asSourceRelativeUrl: (url) => {
      console.log(url, compileDirectoryServerUrl)
      if (url.startsWith(compileDirectoryServerUrl)) {
        return url.slice(compileDirectoryServerUrl.length)
      }
      if (url.startsWith(compileServerOrigin)) {
        return url.slice(compileServerOrigin.length)
      }
      return url
    },
    asSourceUrl: (sourceRelativeUrl) => {
      return `${compileServerOrigin}${sourceRelativeUrl}`
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
