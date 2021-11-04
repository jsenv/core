import {
  assertAndNormalizeDirectoryUrl,
  readDirectory,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { composeTwoV8Coverages } from "./v8_coverage_composition.js"

export const v8CoverageFromNodeV8Directory = async ({
  NODE_V8_COVERAGE,
  coverageIgnorePredicate,
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

  let v8CoverageComposed = null
  await dirContent.reduce(async (previous, dirEntry) => {
    await previous

    const dirEntryUrl = resolveUrl(dirEntry, coverageDirectoryUrl)
    const tryReadJsonFile = async () => {
      try {
        const fileContent = await readFile(dirEntryUrl, { as: "json" })
        return fileContent
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
      const v8Coverage = filterV8Coverage(fileContent, {
        coverageIgnorePredicate,
      })
      v8CoverageComposed = v8CoverageComposed
        ? composeTwoV8Coverages(v8CoverageComposed, v8Coverage)
        : v8Coverage
    }
  }, Promise.resolve())

  return v8CoverageComposed
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
