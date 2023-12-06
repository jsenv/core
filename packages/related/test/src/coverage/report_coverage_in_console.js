import { importWithRequire } from "../helpers/import_with_require.js";
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js";

export const reportCoverageInConsole = (
  testPlanResult,
  { skipEmpty, skipFull } = {},
) => {
  const testPlanCoverage = testPlanResult.coverage;
  if (!testPlanCoverage) {
    // TODO
  }
  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");
  const context = libReport.createContext({
    coverageMap: istanbulCoverageMapFromCoverage(testPlanCoverage),
  });
  const report = reports.create("text", {
    skipEmpty,
    skipFull,
  });
  report.execute(context);
};
