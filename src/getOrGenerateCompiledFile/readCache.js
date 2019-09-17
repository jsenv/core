import { fileRead } from "@dmail/helper"
import { getCacheFilePath } from "./locaters.js"

export const readCache = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  logger,
}) => {
  const cacheFilePath = getCacheFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
  })

  try {
    const cacheAsString = await fileRead(cacheFilePath)
    const cache = JSON.parse(cacheAsString)
    const sourceRelativePathInCache = cache.sourceRelativePath
    if (sourceRelativePathInCache !== sourceRelativePath) {
      logger.info(
        createSourceRelativePathChangedMessage({
          sourceRelativePathInCache,
          sourceRelativePath,
          cacheFilePath,
        }),
      )
      return null
    }
    return cache
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null
    }

    if (error && error.name === "SyntaxError") {
      logger.error(createCacheSyntaxErrorMessage({ syntaxError: error, cacheFilePath }))
      return null
    }

    throw error
  }
}

const createSourceRelativePathChangedMessage = ({
  sourceRelativePathInCache,
  sourceRelativePath,
  cacheFilePath,
}) => `cache.sourceRelativePath changed
--- sourceRelativePath in cache ---
${sourceRelativePathInCache}
--- sourceRelativePath ---
${sourceRelativePath}
--- cache path ---
${cacheFilePath}`

const createCacheSyntaxErrorMessage = ({ syntaxError, cacheFilePath }) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- cache path ---
${cacheFilePath}`
