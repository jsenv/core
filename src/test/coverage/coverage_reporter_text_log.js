import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js"

export const generateCoverageTextLog = (
  coverage,
  { coverageReportSkipEmpty, coverageReportSkipFull },
) => {
  const libReport = requireFromJsenv("istanbul-lib-report")
  const reports = requireFromJsenv("istanbul-reports")

  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
  })
  const report = reports.create("text", {
    skipEmpty: coverageReportSkipEmpty,
    skipFull: coverageReportSkipFull,
  })
  report.execute(context)
}
