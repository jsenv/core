import { readFileSync } from "node:fs"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls"

import { require } from "@jsenv/utils/require.js"
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js"

export const generateCoverageHtmlDirectory = async (
  coverage,
  {
    rootDirectoryUrl,
    coverageHtmlDirectoryRelativeUrl,
    coverageSkipEmpty,
    coverageSkipFull,
  },
) => {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")

  const context = libReport.createContext({
    dir: urlToFileSystemPath(rootDirectoryUrl),
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
    sourceFinder: (path) => {
      return readFileSync(
        urlToFileSystemPath(resolveUrl(path, rootDirectoryUrl)),
        "utf8",
      )
    },
  })

  const report = reports.create("html", {
    skipEmpty: coverageSkipEmpty,
    skipFull: coverageSkipFull,
    subdir: coverageHtmlDirectoryRelativeUrl,
  })
  report.execute(context)
}
