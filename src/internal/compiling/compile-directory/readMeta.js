import { urlToFilePath } from "internal/urlUtils.js"
import { readFileContent } from "internal/filesystemUtils.js"
import { resolveMetaJsonFileUrl } from "./locaters.js"

export const readMeta = async ({ logger, compiledFileUrl }) => {
  const metaJsonFileUrl = resolveMetaJsonFileUrl({
    compiledFileUrl,
  })
  const metaJsonFilePath = urlToFilePath(metaJsonFileUrl)

  try {
    const metaJsonString = await readFileContent(metaJsonFilePath)
    const metaJsonObject = JSON.parse(metaJsonString)
    return metaJsonObject
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null
    }

    if (error && error.name === "SyntaxError") {
      logger.error(
        createCacheSyntaxErrorMessage({
          syntaxError: error,
          metaJsonFilePath,
        }),
      )
      return null
    }

    throw error
  }
}

const createCacheSyntaxErrorMessage = ({ syntaxError, metaJsonFilePath }) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- meta.json path ---
${metaJsonFilePath}`
