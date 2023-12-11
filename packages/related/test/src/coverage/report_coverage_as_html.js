import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { urlToFileSystemPath, urlToRelativeUrl } from "@jsenv/urls";
import { ensureEmptyDirectorySync } from "@jsenv/filesystem";

import { importWithRequire } from "../helpers/import_with_require.js";
import { istanbulCoverageMapFromCoverage } from "./istanbul_coverage_map_from_coverage.js";

export const reportCoverageAsHtml = (
  testPlanResult,
  directoryUrl,
  { skipEmpty, skipFull } = {},
) => {
  if (testPlanResult.aborted) {
    return;
  }
  const testPlanCoverage = testPlanResult.coverage;
  if (!testPlanCoverage) {
    // TODO
  }

  const { rootDirectoryUrl } = testPlanResult;
  ensureEmptyDirectorySync(directoryUrl);
  const coverageHtmlDirectoryRelativeUrl = urlToRelativeUrl(
    directoryUrl,
    rootDirectoryUrl,
  );

  const libReport = importWithRequire("istanbul-lib-report");
  const reports = importWithRequire("istanbul-reports");
  const context = libReport.createContext({
    dir: fileURLToPath(rootDirectoryUrl),
    coverageMap: istanbulCoverageMapFromCoverage(testPlanCoverage),
    sourceFinder: (path) =>
      readFileSync(new URL(path, rootDirectoryUrl), "utf8"),
  });
  const report = reports.create("html", {
    skipEmpty,
    skipFull,
    subdir: coverageHtmlDirectoryRelativeUrl,
  });
  report.execute(context);
  const htmlCoverageDirectoryIndexFileUrl = `${directoryUrl}index.html`;
  console.log(`-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`);
};
