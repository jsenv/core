import { urlToFileSystemPath } from "@jsenv/util"
import { createDetailedMessage } from "@jsenv/logger"
import { getMetaJsonFileUrl } from "./compile-asset.js"
import { readFileContent } from "./fs-optimized-for-cache.js"

export const readMeta = async ({ logger, compiledFileUrl }) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl)

  try {
    const metaJsonString = await readFileContent(metaJsonFileUrl)
    const metaJsonObject = JSON.parse(metaJsonString)
    return metaJsonObject
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger.debug(
        createDetailedMessage(`no meta.json.`, {
          ["meta.json path"]: urlToFileSystemPath(metaJsonFileUrl),
          ["compiled file"]: urlToFileSystemPath(compiledFileUrl),
        }),
      )
      return null
    }

    if (error && error.name === "SyntaxError") {
      logger.error(
        createDetailedMessage(`meta.json syntax error.`, {
          ["syntax error stack"]: error.stack,
          ["meta.json path"]: urlToFileSystemPath(metaJsonFileUrl),
        }),
      )
      return null
    }

    throw error
  }
}
