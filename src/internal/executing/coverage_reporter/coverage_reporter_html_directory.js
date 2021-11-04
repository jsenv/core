import { readFileSync } from "node:fs"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/filesystem"

import { require } from "../../require.js"
import { istanbulCoverageMapFromCoverage } from "./istanbulCoverageMapFromCoverage.js"

export const generateCoverageHtmlDirectory = async (
  coverage,
  {
    projectDirectoryUrl,
    coverageHtmlDirectoryRelativeUrl,
    coverageSkipEmpty,
    coverageSkipFull,
  },
) => {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")

  const context = libReport.createContext({
    dir: urlToFileSystemPath(projectDirectoryUrl),
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
    sourceFinder: (path) => {
      return readFileSync(
        urlToFileSystemPath(resolveUrl(path, projectDirectoryUrl)),
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
