import {
  assertAndNormalizeDirectoryUrl,
  readDirectory,
  readFile,
  resolveUrl,
  normalizeStructuredMetaMap,
  urlToMeta,
  urlToFileSystemPath,
} from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

import { composeV8Coverages } from "./composeV8Coverages.js"
import { composeIstanbulCoverages } from "./composeIstanbulCoverages.js"

const v8ToIstanbul = require("v8-to-istanbul")

export const istanbulCoverageFromV8Coverage = async ({
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
  const istanbulCoverage = await convertV8CoverageToIstanbul(v8Coverage)
  return istanbulCoverage
}

const readV8CoverageReportsFromDirectory = async (coverageDirectory) => {
  const coverageReports = []

  const dirContent = await readDirectory(coverageDirectory)
  // here if dirContent is empty it's quite unexpected
  // but sometime it happens.
  // Maybe we could retry to read the dir content after waiting 500ms
  // but I don't think that is why the dir is empty sometimes
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

const convertV8CoverageToIstanbul = async (v8Coverage) => {
  const istanbulCoverages = await Promise.all(
    v8Coverage.result.map(async (fileV8Coverage) => {
      const sources = sourcesFromSourceMapCache(fileV8Coverage.url, v8Coverage["source-map-cache"])
      const path = urlToFileSystemPath(fileV8Coverage.url)

      const converter = v8ToIstanbul(
        path,
        // wrapperLength is undefined we don't need it
        // https://github.com/istanbuljs/v8-to-istanbul/blob/2b54bc97c5edf8a37b39a171ec29134ba9bfd532/lib/v8-to-istanbul.js#L27
        undefined,
        sources,
      )
      await converter.load()

      converter.applyCoverage(fileV8Coverage.functions)
      const istanbulCoverage = converter.toIstanbul()
      return istanbulCoverage
    }),
  )

  const istanbulCoverageComposed = composeIstanbulCoverages(istanbulCoverages)
  return markCoverageAsConverted(istanbulCoverageComposed)
}

const markCoverageAsConverted = (istanbulCoverage) => {
  const istanbulCoverageMarked = {}
  Object.keys(istanbulCoverage).forEach((key) => {
    istanbulCoverageMarked[key] = {
      ...istanbulCoverage[key],
      fromV8: true,
    }
  })
  return istanbulCoverageMarked
}

const sourcesFromSourceMapCache = (url, sourceMapCache) => {
  const sourceMapAndLineLengths = sourceMapCache[url]
  if (!sourceMapAndLineLengths) {
    return {}
  }

  const { data, lineLengths } = sourceMapAndLineLengths
  // See: https://github.com/nodejs/node/pull/34305
  if (!data) {
    return undefined
  }

  const sources = {
    sourcemap: data,
    ...(lineLengths ? { source: sourcesFromLineLengths(lineLengths) } : {}),
  }
  return sources
}

const sourcesFromLineLengths = (lineLengths) => {
  let source = ""
  lineLengths.forEach((length) => {
    source += `${"".padEnd(length, ".")}\n`
  })
  return source
}
