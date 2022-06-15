import { utimes } from "node:fs"

import { assertAndNormalizeFileUrl } from "./assertAndNormalizeFileUrl.js"
import { urlToFileSystemPath } from "./urlToFileSystemPath.js"

export const writeEntryModificationTime = (source, mtime) => {
  const sourceUrl = assertAndNormalizeFileUrl(source)
  const sourcePath = urlToFileSystemPath(sourceUrl)
  const mtimeValue =
    typeof mtime === "number" ? new Date(Math.floor(mtime)) : mtime
  // reading atime mutates its value so there is no use case I can think of
  // where we want to modify it
  const atimeValue = mtimeValue

  return new Promise((resolve, reject) => {
    utimes(sourcePath, atimeValue, mtimeValue, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
