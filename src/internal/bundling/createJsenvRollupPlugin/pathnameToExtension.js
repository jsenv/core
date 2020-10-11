export const pathnameToExtension = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/")
  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1)
  }

  const dotLastIndex = pathname.lastIndexOf(".")
  if (dotLastIndex === -1) return ""
  // if (dotLastIndex === pathname.length - 1) return ""
  return pathname.slice(dotLastIndex)
}
