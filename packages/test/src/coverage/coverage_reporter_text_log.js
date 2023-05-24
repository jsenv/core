import { importWithRequire } from "../helpers/import_with_require.js";
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js";

export const generateCoverageTextLog = (
  coverage,
  { coverageReportSkipEmpty, coverageReportSkipFull },
) => {
  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");

  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
  });
  const report = reports.create("text", {
    skipEmpty: coverageReportSkipEmpty,
    skipFull: coverageReportSkipFull,
  });
  report.execute(context);
};
