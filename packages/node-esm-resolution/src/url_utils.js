export const filesystemRootUrl =
  process.platform === "win32" ? `file///${process.cwd()[0]}:/` : "file:///"

export const asDirectoryUrl = (url) => {
  const { pathname } = new URL(url)
  if (pathname.endsWith("/")) {
    return url
  }
  return new URL("./", url).href
}

export const getParentUrl = (url) => {
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
