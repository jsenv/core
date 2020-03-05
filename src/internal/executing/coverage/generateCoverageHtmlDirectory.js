import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "../../require.js"

const { readFileSync } = require("fs")
const libReport = require("istanbul-lib-report")
const reports = require("istanbul-reports")
const { createCoverageMap } = require("istanbul-lib-coverage")

export const generateCoverageHtmlDirectory = async (
  coverageMap,
  htmlDirectoryRelativeUrl,
  projectDirectoryUrl,
) => {
  const context = libReport.createContext({
    dir: urlToFileSystemPath(projectDirectoryUrl),
    coverageMap: createCoverageMap(coverageMap),
    sourceFinder: (path) => {
      return readFileSync(urlToFileSystemPath(resolveUrl(path, projectDirectoryUrl)), "utf8")
    },
  })

  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true,
    subdir: htmlDirectoryRelativeUrl,
  })
  report.execute(context)
}
