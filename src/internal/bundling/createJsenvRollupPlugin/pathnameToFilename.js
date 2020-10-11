export const pathnameToFilename = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/")
  const filename = slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1)
  return filename
}
