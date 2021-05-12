import { require } from "../../require.js"

import { istanbulCoverageMapFromCoverage } from "./istanbulCoverageMapFromCoverage.js"

export const generateCoverageTextLog = (coverage, { coverageSkipEmpty, coverageSkipFull }) => {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")

  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
  })
  const report = reports.create("text", {
    skipEmpty: coverageSkipEmpty,
    skipFull: coverageSkipFull,
  })
  report.execute(context)
}
