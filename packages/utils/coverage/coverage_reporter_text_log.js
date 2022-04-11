import { require } from "@jsenv/utils/require.js"

import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js"

export const generateCoverageTextLog = (
  coverage,
  { coverageSkipEmpty, coverageSkipFull },
) => {
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
