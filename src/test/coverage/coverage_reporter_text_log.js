import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js"

export const generateCoverageTextLog = (
  coverage,
  { coverageSkipEmpty, coverageSkipFull },
) => {
  const libReport = requireFromJsenv("istanbul-lib-report")
  const reports = requireFromJsenv("istanbul-reports")

  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
  })
  const report = reports.create("text", {
    skipEmpty: coverageSkipEmpty,
    skipFull: coverageSkipFull,
  })
  report.execute(context)
}
