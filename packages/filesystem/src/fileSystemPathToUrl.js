import { pathToFileURL } from "url"
import { isFileSystemPath } from "./isFileSystemPath.js"

export const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`)
  }
  return String(pathToFileURL(value))
}
