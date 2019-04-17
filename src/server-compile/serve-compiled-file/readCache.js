import { fileRead } from "@dmail/helper"
import { getCacheFilename } from "./locaters.js"

export const readCache = async ({
  projectFolder,
  sourceFilenameRelative,
  compiledFilenameRelative,
}) => {
  const cacheFilename = getCacheFilename({
    projectFolder,
    compiledFilenameRelative,
  })

  try {
    const cacheContent = await fileRead(cacheFilename)
    const cache = JSON.parse(cacheContent)
    if (cache.sourceFilenameRelative !== sourceFilenameRelative) {
      throw createCacheCorruptionError({
        sourceFilenameRelative,
        cacheSourceFilenameRelative: cache.sourceFilenameRelative,
        cacheFilename,
      })
    }
    return cache
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    throw error
  }
}

const createCacheCorruptionError = ({
  sourceFilenameRelative,
  cacheFilename,
  cacheSourceFilenameRelative,
}) => {
  const error = new Error(
    createCacheCorruptionErrorMessage({
      sourceFilenameRelative,
      cacheFilename,
      cacheSourceFilenameRelative,
    }),
  )
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const createCacheCorruptionErrorMessage = ({
  sourceFilenameRelative,
  cacheFilename,
  cacheSourceFilenameRelative,
}) => `cache sourceFilenameRelative does not match.
sourceFilenameRelative: ${sourceFilenameRelative}
cacheFilename: ${cacheFilename}
cacheSourceFilenameRelative: ${cacheSourceFilenameRelative}`
