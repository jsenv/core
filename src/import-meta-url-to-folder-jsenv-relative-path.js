import {
  importMetaURLToFolderPath,
  pathnameToRelativePathname,
  operatingSystemPathToPathname,
} from "@jsenv/operating-system-path"
import { JSENV_PATHNAME } from "./JSENV_PATH.js"

export const importMetaURLToFolderJsenvRelativePath = (importMetaURL) => {
  const folderPath = importMetaURLToFolderPath(importMetaURL)
  const folderPathname = operatingSystemPathToPathname(folderPath)
  return pathnameToRelativePathname(folderPathname, JSENV_PATHNAME)
}
