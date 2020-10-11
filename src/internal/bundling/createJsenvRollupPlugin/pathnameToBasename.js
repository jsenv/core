export const pathnameToBasename = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/")
  const basename = slashLastIndex === -1 ? pathname : pathname.slice(slashLastIndex + 1)
  const dotLastIndex = basename.lastIndexOf(".")
  return dotLastIndex === -1 ? basename : pathname.slice(dotLastIndex)
}
