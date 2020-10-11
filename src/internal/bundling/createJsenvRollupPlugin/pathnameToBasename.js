export const pathnameToBasename = (pathname) => {
  const filename = pathnameToFilename(pathname)
  const dotLastIndex = filename.lastIndexOf(".")
  const basename = dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex)
  return basename
}

const pathnameToFilename = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/")
  const filename = slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1)
  return filename
}
