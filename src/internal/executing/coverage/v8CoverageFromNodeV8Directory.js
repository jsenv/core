import {
  assertAndNormalizeDirectoryUrl,
  readDirectory,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { v8CoverageFromAllV8Coverages } from "./v8CoverageFromAllV8Coverages.js"

export const v8CoverageFromNodeV8Directory = async ({
  projectDirectoryUrl,
  NODE_V8_COVERAGE,
  coverageConfig,
}) => {
  const allV8Coverages = await readV8CoverageReportsFromDirectory(NODE_V8_COVERAGE)

  const v8Coverage = v8CoverageFromAllV8Coverages(allV8Coverages, {
    coverageRootUrl: projectDirectoryUrl,
    coverageConfig,
  })

  return v8Coverage
}

const readV8CoverageReportsFromDirectory = async (coverageDirectory) => {
  const tryReadDirectory = async (timeSpentTrying = 0) => {
    const dirContent = await readDirectory(coverageDirectory)
    if (dirContent.length > 0) {
      return dirContent
    }
    if (timeSpentTrying > 1500) {
      console.warn(`v8 coverage directory is empty at ${coverageDirectory}`)
      return dirContent
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    return tryReadDirectory(timeSpentTrying + 100)
  }
  const dirContent = await tryReadDirectory()

  const coverageReports = []

  const coverageDirectoryUrl = assertAndNormalizeDirectoryUrl(coverageDirectory)
  await Promise.all(
    dirContent.map(async (dirEntry) => {
      const dirEntryUrl = resolveUrl(dirEntry, coverageDirectoryUrl)
      try {
        const fileContent = await readFile(dirEntryUrl, { as: "json" })
        if (fileContent) {
          coverageReports.push(fileContent)
        }
      } catch (e) {
        console.warn(`Error while reading coverage file
--- error stack ---
${e.stack}
--- file ---
${dirEntryUrl}`)
        return
      }
    }),
  )

  return coverageReports
}
