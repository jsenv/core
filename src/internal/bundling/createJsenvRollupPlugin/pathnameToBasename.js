import { pathnameToFilename } from "./pathnameToFilename.js"

export const pathnameToBasename = (pathname) => {
  const filename = pathnameToFilename(pathname)
  const dotLastIndex = filename.lastIndexOf(".")
  const basename = dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex)
  return basename
}
