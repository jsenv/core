import { urlToFilename } from "./urlToFilename.js"

export const urlToBasename = (url) => {
  const filename = urlToFilename(url)
  const dotLastIndex = filename.lastIndexOf(".")
  const basename =
    dotLastIndex === -1 ? filename : filename.slice(0, dotLastIndex)
  return basename
}
