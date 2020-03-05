import { urlToFileSystemPath } from "@jsenv/util"
import { require } from "../../require.js"

const libReport = require("istanbul-lib-report")
const reports = require("istanbul-reports")
const { createCoverageMap } = require("istanbul-lib-coverage")

export const generateCoverageHtmlDirectory = async (coverageMap, htmlDirectoryUrl) => {
  const context = libReport.createContext({
    dir: urlToFileSystemPath(htmlDirectoryUrl),
    coverageMap: createCoverageMap(coverageMap),
  })

  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true,
    // subdir: 'whatever'
  })
  report.execute(context)
}
