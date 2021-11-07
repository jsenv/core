import {
  assertAndNormalizeDirectoryUrl,
  readDirectory,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

export const visitNodeV8Directory = async ({
  // signal
  NODE_V8_COVERAGE,
  onV8Coverage,
}) => {
  const tryReadDirectory = async () => {
    const dirContent = await readDirectory(NODE_V8_COVERAGE)
    if (dirContent.length > 0) {
      return dirContent
    }
    console.warn(`v8 coverage directory is empty at ${NODE_V8_COVERAGE}`)
    return dirContent
  }
  const dirContent = await tryReadDirectory()

  const coverageDirectoryUrl = assertAndNormalizeDirectoryUrl(NODE_V8_COVERAGE)
  await dirContent.reduce(async (previous, dirEntry) => {
    await previous

    const dirEntryUrl = resolveUrl(dirEntry, coverageDirectoryUrl)
    const tryReadJsonFile = async () => {
      const fileContent = await readFile(dirEntryUrl, { as: "string" })
      if (fileContent === "") {
        return null
      }

      try {
        const fileAsJson = JSON.parse(fileContent)
        return fileAsJson
      } catch (e) {
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
}

export const filterV8Coverage = (v8Coverage, { coverageIgnorePredicate }) => {
  const v8CoverageFiltered = {
    ...v8Coverage,
    result: v8Coverage.result.filter((fileReport) => {
      return !coverageIgnorePredicate(fileReport.url)
    }),
  }
  return v8CoverageFiltered
}
