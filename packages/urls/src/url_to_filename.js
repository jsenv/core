import { urlToPathname } from "./urlToPathname.js"

export const urlToFilename = (url) => {
  const pathname = urlToPathname(url)
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
