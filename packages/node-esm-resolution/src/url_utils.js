export const asDirectoryUrl = (url) => {
  const { pathname } = new URL(url)
  if (pathname.endsWith("/")) {
    return url
  }
  return new URL("./", url).href
}

export const getParentUrl = (url) => {
  if (url.startsWith("file://")) {
    // With node.js new URL('../', 'file:///C:/').href
    // returns "file:///C:/" instead of "file:///"
    const ressource = url.slice("file://".length)
    const slashLastIndex = ressource.lastIndexOf("/")
    if (slashLastIndex === -1) {
      return url
    }
    const lastCharIndex = ressource.length - 1
    if (slashLastIndex === lastCharIndex) {
      const slashBeforeLastIndex = ressource.lastIndexOf(
        "/",
        slashLastIndex - 1,
      )
      if (slashBeforeLastIndex === -1) {
        return url
      }
      return `file://${ressource.slice(0, slashBeforeLastIndex + 1)}`
    }

    return `file://${ressource.slice(0, slashLastIndex + 1)}`
  }
  return new URL(url.endsWith("/") ? "../" : "./", url).href
}

export const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

export const urlToFilename = (url) => {
  const { pathname } = new URL(url)
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/")
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1)
  return filename
}
