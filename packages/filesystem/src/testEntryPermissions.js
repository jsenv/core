import { promises, constants } from "node:fs"

import { assertAndNormalizeFileUrl } from "./assertAndNormalizeFileUrl.js"
import { urlToFileSystemPath } from "./urlToFileSystemPath.js"

const { access } = promises
const {
  // F_OK,
  R_OK,
  W_OK,
  X_OK,
} = constants

export const testEntryPermissions = async (
  source,
  {
    read = false,
    write = false,
    execute = false,
    allowedIfNotFound = false,
  } = {},
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source)
  const sourcePath = urlToFileSystemPath(sourceUrl)
  let binaryFlags = 0

  // if (visible) binaryFlags |= F_OK
  if (read) binaryFlags |= R_OK
  if (write) binaryFlags |= W_OK
  if (execute) binaryFlags |= X_OK

  try {
    await access(sourcePath, binaryFlags)
    return true
  } catch (error) {
    if (error.code === "ENOENT") {
      if (allowedIfNotFound) {
        return true
      }
      throw error
    }
    return false
  }
}
