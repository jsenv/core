import {
  importMetaURLToFolderPath,
  pathnameToRelativePathname,
  operatingSystemPathToPathname,
} from "@jsenv/operating-system-path"
import { jsenvCorePathname } from "../src/jsenvCorePath.js"

export const fileHrefToFolderRelativePath = (fileHref) => {
  const folderPath = importMetaURLToFolderPath(fileHref)
  const folderPathname = operatingSystemPathToPathname(folderPath)
  return pathnameToRelativePathname(folderPathname, jsenvCorePathname)
}
