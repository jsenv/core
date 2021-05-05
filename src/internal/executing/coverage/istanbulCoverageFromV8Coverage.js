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
import { composeIstanbulCoverages } from "./composeIstanbulCoverages.js"

const { mergeProcessCovs } = require("@c88/v8-coverage")

const v8ToIstanbul = require("v8-to-istanbul")

export const istanbulCoverageFromV8Coverage = async ({
  projectDirectoryUrl,
  NODE_V8_COVERAGE,
  coverageConfig,
}) => {
  const coverageReports = await readV8CoverageReportsFromDirectory(NODE_V8_COVERAGE)
  const coverageReportsFiltered = filterCoverageReports(coverageReports, {
    projectDirectoryUrl,
    coverageConfig,
  })
  // mergeCoverageReports do not preserves source-map-cache during the merge
  // so we store sourcemap cache now
  const sourceMapCache = {}
  coverageReportsFiltered.forEach((coverageReport) => {
    coverageReport.result.forEach((fileReport) => {
      if (fileReport["source-map-cache"]) {
        Object.assign(sourceMapCache, fileReport["source-map-cache"])
      }
    })
  })

  const coverageReport = mergeCoverageReports(coverageReportsFiltered)
  const istanbulCoverage = await convertV8CoverageToIstanbul(coverageReport, {
    sourceMapCache,
  })
  return istanbulCoverage
}

const readV8CoverageReportsFromDirectory = async (coverageDirectory) => {
  const coverageReports = []

  const dirContent = await readDirectory(coverageDirectory)
  const coverageDirectoryUrl = assertAndNormalizeDirectoryUrl(coverageDirectory)
  await Promise.all(
    dirContent.map(async (dirEntry) => {
      const dirEntryUrl = resolveUrl(dirEntry, coverageDirectoryUrl)
      const fileContent = await readFile(dirEntryUrl, { as: "json" })
      if (fileContent) {
        coverageReports.push(fileContent)
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

const mergeCoverageReports = (coverageReports) => {
  const coverageReport = mergeProcessCovs(coverageReports)
  return coverageReport
}

const convertV8CoverageToIstanbul = async (coverageReport, { sourceMapCache }) => {
  const istanbulCoverages = await Promise.all(
    coverageReport.result.map(async (fileV8Coverage) => {
      const sources = sourcesFromSourceMapCache(fileV8Coverage.url, sourceMapCache)
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
