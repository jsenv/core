import { fileRead } from "@dmail/helper"
import { getCacheFilePath } from "./locaters.js"

export const readCache = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
}) => {
  const cacheFilePath = getCacheFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
  })

  try {
    const cacheAsString = await fileRead(cacheFilePath)
    const cache = JSON.parse(cacheAsString)
    if (cache.sourceRelativePath !== sourceRelativePath) {
      return null
    }
    return cache
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    // we should log the error
    if (error && error.name === "SyntaxError") return null
    throw error
  }
}
