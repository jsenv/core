import { dirname } from "node:path"

import { assertAndNormalizeFileUrl } from "./assertAndNormalizeFileUrl.js"
import { urlToFileSystemPath } from "./urlToFileSystemPath.js"
import { writeDirectory } from "./writeDirectory.js"

export const ensureParentDirectories = async (destination) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination)
  const destinationPath = urlToFileSystemPath(destinationUrl)
  const destinationParentPath = dirname(destinationPath)

  return writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true,
  })
}
