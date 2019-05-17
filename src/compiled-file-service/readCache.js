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
      throw createCacheCorruptionError({
        sourceRelativePath,
        cacheSourcePath: cache.sourceRelativePath,
        cacheFilename,
      })
    }
    return cache
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    throw error
  }
}

const createCacheCorruptionError = ({ sourceRelativePath, cacheSourcePath, cacheFilename }) => {
  const error = new Error(
    createCacheCorruptionErrorMessage({
      sourceRelativePath,
      cacheFilename,
      cacheSourcePath,
    }),
  )
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const createCacheCorruptionErrorMessage = ({
  sourceRelativePath,
  cacheSourcePath,
  cacheFilename,
}) => `cache sourceRelativePath does not match.
sourceRelativePath: ${sourceRelativePath}
cacheSourcePath: ${cacheSourcePath}
cacheFilename: ${cacheFilename}`
