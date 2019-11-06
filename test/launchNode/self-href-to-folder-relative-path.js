import {
  importMetaURLToFolderPath,
  pathnameToRelativePathname,
  operatingSystemPathToPathname,
} from "@jsenv/operating-system-path"
import { launchNodeProjectPath } from "../index.js"

export const selfHrefToFolderRelativePath = (fileHref) => {
  const folderPath = importMetaURLToFolderPath(fileHref)
  const folderPathname = operatingSystemPathToPathname(folderPath)
  return pathnameToRelativePathname(folderPathname, launchNodeProjectPath)
}
