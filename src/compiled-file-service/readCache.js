import { fileRead } from "@dmail/helper"
import { getCacheFilename } from "./locaters.js"

export const readCache = async ({ projectPathname, sourceRelativePath, compileRelativePath }) => {
  const cacheFilename = getCacheFilename({
    projectPathname,
    compileRelativePath,
  })

  try {
    const cacheContent = await fileRead(cacheFilename)
    const cache = JSON.parse(cacheContent)
    if (cache.sourceRelativePath !== sourceRelativePath) {
      return null
    }
    return cache
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    throw error
  }
}
