import {
  assertAndNormalizeDirectoryUrl,
  readDirectory,
  readFile,
  resolveUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/util"

import { composeV8Coverages } from "./composeV8Coverages.js"

export const v8CoverageFromNodeV8Directory = async ({
  projectDirectoryUrl,
  NODE_V8_COVERAGE,
  coverageConfig,
}) => {
  const allV8Coverages = await readV8CoverageReportsFromDirectory(NODE_V8_COVERAGE)
  const v8Coverages = filterCoverageReports(allV8Coverages, {
    projectDirectoryUrl,
    coverageConfig,
  })

  const v8Coverage = composeV8Coverages(v8Coverages)
  return v8Coverage
}

const readV8CoverageReportsFromDirectory = async (coverageDirectory) => {
  const coverageReports = []

  const dirContent = await readDirectory(coverageDirectory)
  if (dirContent.length === 0) {
    debugger
    // here if dirContent is empty it's quite unexpected
    // but sometime it happens.
  }
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

const filterCoverageReports = (coverageReports, { projectDirectoryUrl, coverageConfig }) => {
  const structuredMetaMapForCover = normalizeStructuredMetaMap(
    {
      cover: coverageConfig,
    },
    projectDirectoryUrl,
  )
  const shouldIgnoreCoverage = (url) => {
    return !urlToMeta({
      url: resolveUrl(url, projectDirectoryUrl),
      structuredMetaMap: structuredMetaMapForCover,
    }).cover
  }

  return coverageReports.map((coverageReport) => {
    return {
      ...coverageReport,
      result: coverageReport.result.filter((fileReport) => {
        return !shouldIgnoreCoverage(fileReport.url)
      }),
    }
  })
}
