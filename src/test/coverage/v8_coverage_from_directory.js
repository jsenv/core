import { readFileSync, readdirSync } from "node:fs"
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/log"
import { Abort } from "@jsenv/abort"

export const visitNodeV8Directory = async ({
  logger,
  signal,
  NODE_V8_COVERAGE,
  onV8Coverage,
  maxMsWaitingForNodeToWriteCoverageFile = 2000,
}) => {
  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)

  let timeSpentTrying = 0
  const tryReadDirectory = async () => {
    const dirContent = readdirSync(NODE_V8_COVERAGE)
    if (dirContent.length > 0) {
      return dirContent
    }
    if (timeSpentTrying < maxMsWaitingForNodeToWriteCoverageFile) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      timeSpentTrying += 200
      logger.debug("retry to read coverage directory")
      return tryReadDirectory()
    }
    logger.warn(`v8 coverage directory is empty at ${NODE_V8_COVERAGE}`)
    return dirContent
  }

  try {
    operation.throwIfAborted()
    const dirContent = await tryReadDirectory()

    const coverageDirectoryUrl =
      assertAndNormalizeDirectoryUrl(NODE_V8_COVERAGE)

    await dirContent.reduce(async (previous, dirEntry) => {
      operation.throwIfAborted()
      await previous

      const dirEntryUrl = new URL(dirEntry, coverageDirectoryUrl)
      const tryReadJsonFile = async () => {
        const fileContent = String(readFileSync(dirEntryUrl))
        if (fileContent === "") {
          if (timeSpentTrying < maxMsWaitingForNodeToWriteCoverageFile) {
            await new Promise((resolve) => setTimeout(resolve, 200))
            timeSpentTrying += 200
            return tryReadJsonFile()
          }
          console.warn(`Coverage JSON file is empty at ${dirEntryUrl}`)
          return null
        }

        try {
          const fileAsJson = JSON.parse(fileContent)
          return fileAsJson
        } catch (e) {
          if (timeSpentTrying < maxMsWaitingForNodeToWriteCoverageFile) {
            await new Promise((resolve) => setTimeout(resolve, 200))
            timeSpentTrying += 200
            return tryReadJsonFile()
          }
          console.warn(
            createDetailedMessage(`Error while reading coverage file`, {
              "error stack": e.stack,
              "file": dirEntryUrl,
            }),
          )
          return null
        }
      }

      const fileContent = await tryReadJsonFile()
      if (fileContent) {
        onV8Coverage(fileContent)
      }
    }, Promise.resolve())
  } finally {
    await operation.end()
  }
}

export const filterV8Coverage = (v8Coverage, { urlShouldBeCovered }) => {
  const v8CoverageFiltered = {
    ...v8Coverage,
    result: v8Coverage.result.filter((fileReport) =>
      urlShouldBeCovered(fileReport.url),
    ),
  }
  return v8CoverageFiltered
}
