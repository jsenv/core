import {
  assertAndNormalizeDirectoryUrl,
  readDirectory,
  readFile,
  resolveUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

// const v8ToIstanbul = require("v8-to-istanbul")

/*

il faudra aurement en premier lieu merge v8 en un seul objet

on excluera surement le coverage en fonction de shouldIntstrument (voir babel-plugin-instrument.js)

https://github.com/bcoe/c8/blob/58f23d1a3f8916b2be4af7f1c3cefa1c8ceea4b5/lib/report.js#L169

on voudrai aussi surement exclure node:
https://github.com/bcoe/c8/blob/58f23d1a3f8916b2be4af7f1c3cefa1c8ceea4b5/lib/report.js#L273


on dirait que v8toIstanbul accept sources

https://github.com/bcoe/c8/blob/58f23d1a3f8916b2be4af7f1c3cefa1c8ceea4b5/lib/report.js#L91

et qu'il lit les truc depuis les sourcemap du json v8

https://github.com/bcoe/c8/blob/58f23d1a3f8916b2be4af7f1c3cefa1c8ceea4b5/lib/report.js#L140

*/

export const coverageMapFromV8Coverage = async ({
  projectDirectoryUrl,
  NODE_V8_COVERAGE,
  coverageConfig,
}) => {
  const {
    coverageFileReports,
    // coverageSourcemapCache
  } = await readV8CoverageReportFromDirectory(NODE_V8_COVERAGE)

  const reports = filterCoverageFileReports(coverageFileReports, {
    projectDirectoryUrl,
    coverageConfig,
  })
  console.log(reports)

  return reports
}

const readV8CoverageReportFromDirectory = async (coverageDirectory) => {
  const dirContent = await readDirectory(coverageDirectory)
  const coverageDirectoryUrl = assertAndNormalizeDirectoryUrl(coverageDirectory)

  const coverageFileReports = []
  const coverageSourcemapCache = {}
  await Promise.all(
    dirContent.map(async (dirEntry) => {
      const dirEntryUrl = resolveUrl(dirEntry, coverageDirectoryUrl)
      const fileContent = await readFile(dirEntryUrl, { as: "json" })
      if (fileContent) {
        if (fileContent.result) {
          coverageFileReports.push(...fileContent.result)
        }
        if (fileContent["source-map-cache"]) {
          Object.assign(coverageSourcemapCache, fileContent["source-map-cache"])
        }
      }
    }),
  )

  return { coverageFileReports, coverageSourcemapCache }
}

const filterCoverageFileReports = (
  coverageFileReports,
  { projectDirectoryUrl, coverageConfig },
) => {
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

  return coverageFileReports.filter((report) => {
    if (shouldIgnoreCoverage(report.url)) {
      return false
    }
    return true
  })
}

const composeV8Coverages = (reports) => {
  const { mergeProcessCovs } = require("@c88/v8-coverage")
}
