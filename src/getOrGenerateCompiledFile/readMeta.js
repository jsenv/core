import { fileRead } from "@dmail/helper"
import { getPathForMetaJsonFile } from "./locaters.js"

export const readMeta = async ({
  logger,
  compileDirectoryUrl,
  relativePathToProjectDirectory,
  relativePathToCompileDirectory,
}) => {
  const metaJsonFilePath = getPathForMetaJsonFile({
    compileDirectoryUrl,
    relativePathToCompileDirectory,
  })

  try {
    const metaJsonString = await fileRead(metaJsonFilePath)
    const metaJsonObject = JSON.parse(metaJsonString)
    const relativePathToProjectDirectoryFromMeta = metaJsonObject.relativePathToProjectDirectory
    if (relativePathToProjectDirectoryFromMeta !== relativePathToProjectDirectory) {
      logger.info(
        createRelativePathToProjectDirectoryChangedMessage({
          relativePathToProjectDirectoryFromMeta,
          relativePathToProjectDirectory,
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

const createRelativePathToProjectDirectoryChangedMessage = ({
  relativePathToProjectDirectoryFromMeta,
  relativePathToProjectDirectory,
  metaJsonFilePath,
}) => `unexpected relativePathToProjectDirectory in meta.json
--- relativePathToProjectDirectory in meta.json ---
${relativePathToProjectDirectoryFromMeta}
--- relativePathToProjectDirectory ---
${relativePathToProjectDirectory}
--- meta.json path ---
${metaJsonFilePath}`

const createCacheSyntaxErrorMessage = ({ syntaxError, metaJsonFilePath }) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- meta.json path ---
${metaJsonFilePath}`
