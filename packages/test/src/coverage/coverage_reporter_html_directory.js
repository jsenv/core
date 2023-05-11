import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { requireFromJsenv } from "@jsenv/core/src/helpers/require_from_jsenv.js";
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js";

export const generateCoverageHtmlDirectory = async (
  coverage,
  {
    rootDirectoryUrl,
    coverageHtmlDirectoryRelativeUrl,
    coverageReportSkipEmpty,
    coverageReportSkipFull,
  },
) => {
  const libReport = requireFromJsenv("istanbul-lib-report");
  const reports = requireFromJsenv("istanbul-reports");

  const context = libReport.createContext({
    dir: fileURLToPath(rootDirectoryUrl),
    coverageMap: istanbulCoverageMapFromCoverage(coverage),
    sourceFinder: (path) =>
      readFileSync(new URL(path, rootDirectoryUrl), "utf8"),
  });

  const report = reports.create("html", {
    skipEmpty: coverageReportSkipEmpty,
    skipFull: coverageReportSkipFull,
    subdir: coverageHtmlDirectoryRelativeUrl,
  });
  report.execute(context);
};
