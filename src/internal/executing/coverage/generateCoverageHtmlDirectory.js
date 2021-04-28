import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "../../require.js"

const { readFileSync } = require("fs")

export const generateCoverageHtmlDirectory = async (
  coverageMap,
  { projectDirectoryUrl, coverageHtmlDirectoryRelativeUrl, coverageSkipEmpty, coverageSkipFull },
) => {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")
  const { createCoverageMap } = require("istanbul-lib-coverage")

  const context = libReport.createContext({
    dir: urlToFileSystemPath(projectDirectoryUrl),
    coverageMap: createCoverageMap(coverageMap),
    sourceFinder: (path) => {
      return readFileSync(urlToFileSystemPath(resolveUrl(path, projectDirectoryUrl)), "utf8")
    },
  })

  const report = reports.create("html", {
    skipEmpty: coverageSkipEmpty,
    skipFull: coverageSkipFull,
    subdir: coverageHtmlDirectoryRelativeUrl,
  })
  report.execute(context)
}
