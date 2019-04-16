import { fileRead } from "@dmail/helper"
import { getCacheFilename } from "./locaters.js"

export const readCache = async ({ projectFolder, filenameRelative }) => {
  const cacheFilename = getCacheFilename({
    projectFolder,
    filenameRelative,
  })

  try {
    const cacheContent = await fileRead(cacheFilename)
    const cache = JSON.parse(cacheContent)
    if (cache.filenameRelative !== filenameRelative) {
      throw createCacheCorruptionError({
        filenameRelative,
        cacheFilenameRelative: cache.filenameRelative,
        cacheFilename,
      })
    }
    return cache
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    throw error
  }
}

const createCacheCorruptionError = ({ filenameRelative, cacheFilename, cacheFilenameRelative }) => {
  const error = new Error(
    createCacheCorruptionErrorMessage({ filenameRelative, cacheFilename, cacheFilenameRelative }),
  )
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const createCacheCorruptionErrorMessage = ({
  filenameRelative,
  cacheFilename,
  cacheFilenameRelative,
}) => `cache filenameRelative does not match.
filenameRelative: ${filenameRelative}
cacheFilename: ${cacheFilename}
cacheFilenameRelative: ${cacheFilenameRelative}`
