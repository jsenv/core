import { fileRead } from "@dmail/helper"
import { getCacheJsonFilePath } from "./locaters.js"

export const readCache = async ({
  cacheDirectoryUrl,
  sourceRelativePath,
  compileRelativePath,
  logger,
}) => {
  const cacheJsonFilePath = getCacheJsonFilePath({
    cacheDirectoryUrl,
    compileRelativePath,
  })

  try {
    const cacheJsonFileString = await fileRead(cacheJsonFilePath)
    const cacheJsonObject = JSON.parse(cacheJsonFileString)
    const sourceRelativePathInCache = cacheJsonObject.sourceRelativePath
    if (sourceRelativePathInCache !== sourceRelativePath) {
      logger.info(
        createSourceRelativePathChangedMessage({
          sourceRelativePathInCache,
          sourceRelativePath,
          cacheJsonFilePath,
        }),
      )
      return null
    }
    return cacheJsonObject
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null
    }

    if (error && error.name === "SyntaxError") {
      logger.error(createCacheSyntaxErrorMessage({ syntaxError: error, cacheJsonFilePath }))
      return null
    }

    throw error
  }
}

const createSourceRelativePathChangedMessage = ({
  sourceRelativePathInCache,
  sourceRelativePath,
  cacheJsonFilePath,
}) => `cache.sourceRelativePath changed
--- sourceRelativePath in cache ---
${sourceRelativePathInCache}
--- sourceRelativePath ---
${sourceRelativePath}
--- cache.json path ---
${cacheJsonFilePath}`

const createCacheSyntaxErrorMessage = ({ syntaxError, cacheJsonFilePath }) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- cache.json path ---
${cacheJsonFilePath}`
