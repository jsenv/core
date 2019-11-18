import { fileUrlToPath } from "internal/urlUtils.js"
import { readFileContent } from "internal/filesystemUtils.js"
import { resolveMetaJsonFileUrl } from "./locaters.js"

export const readMeta = async ({
  logger,
  projectDirectoryUrl,
  originalFileRelativeUrl,
  compiledFileRelativeUrl,
}) => {
  const metaJsonFileUrl = resolveMetaJsonFileUrl({
    projectDirectoryUrl,
    compiledFileRelativeUrl,
  })
  const metaJsonFilePath = fileUrlToPath(metaJsonFileUrl)

  try {
    const metaJsonString = await readFileContent(metaJsonFilePath)
    const metaJsonObject = JSON.parse(metaJsonString)
    const originalFileRelativeUrlFromMeta = metaJsonObject.originalFileRelativeUrl
    if (originalFileRelativeUrlFromMeta !== originalFileRelativeUrl) {
      logger.info(
        createOriginalFileRelativeUrlChangedMessage({
          originalFileRelativeUrlFromMeta,
          originalFileRelativeUrl,
          metaJsonFilePath,
        }),
      )
      return null
    }
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

const createOriginalFileRelativeUrlChangedMessage = ({
  originalFileRelativeUrlFromMeta,
  originalFileRelativeUrl,
  metaJsonFilePath,
}) => `unexpected originalFileRelativeUrl in meta.json
--- originalFileRelativeUrl in meta.json ---
${originalFileRelativeUrlFromMeta}
--- originalFileRelativeUrl ---
${originalFileRelativeUrl}
--- meta.json path ---
${metaJsonFilePath}`

const createCacheSyntaxErrorMessage = ({ syntaxError, metaJsonFilePath }) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- meta.json path ---
${metaJsonFilePath}`
