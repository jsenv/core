import { urlToFileSystemPath, readFile } from "@jsenv/util"
import { resolveMetaJsonFileUrl } from "./locaters.js"

export const readMeta = async ({ logger, compiledFileUrl }) => {
  const metaJsonFileUrl = resolveMetaJsonFileUrl({
    compiledFileUrl,
  })

  try {
    const metaJsonString = await readFile(metaJsonFileUrl)
    const metaJsonObject = JSON.parse(metaJsonString)
    return metaJsonObject
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger.debug(`no meta.json.
--- meta.json path ---
${urlToFileSystemPath(metaJsonFileUrl)}
--- compiled file ---
${urlToFileSystemPath(compiledFileUrl)}`)
      return null
    }

    if (error && error.name === "SyntaxError") {
      logger.error(
        createCacheSyntaxErrorMessage({
          syntaxError: error,
          metaJsonFileUrl,
        }),
      )
      return null
    }

    throw error
  }
}

const createCacheSyntaxErrorMessage = ({ syntaxError, metaJsonFileUrl }) => `meta.json syntax error.
--- syntax error stack ---
${syntaxError.stack}
--- meta.json path ---
${urlToFileSystemPath(metaJsonFileUrl)}`
