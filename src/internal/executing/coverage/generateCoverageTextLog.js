import { require } from "../../require.js"

export const generateCoverageTextLog = (coverageMap, { coverageSkipEmpty, coverageSkipFull }) => {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")
  const { createCoverageMap } = require("istanbul-lib-coverage")

  const context = libReport.createContext({
    coverageMap: createCoverageMap(coverageMap),
  })
  const report = reports.create("text", {
    skipEmpty: coverageSkipEmpty,
    skipFull: coverageSkipFull,
  })
  report.execute(context)
}
