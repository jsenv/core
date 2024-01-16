import { urlToFileSystemPath } from "@jsenv/urls";
import { writeFileSync } from "@jsenv/filesystem";
import { humanizeFileSize } from "@jsenv/humanize";

export const reportCoverageAsJson = (
  testPlanResult,
  fileUrl,
  { logs } = {},
) => {
  if (testPlanResult.aborted) {
    return;
  }
  const testPlanCoverage = testPlanResult.coverage;
  if (!testPlanCoverage) {
    // TODO: throw an error
  }
  const coverageAsText = JSON.stringify(testPlanCoverage, null, "  ");
  writeFileSync(fileUrl, coverageAsText);
  if (logs) {
    console.log(
      `-> ${urlToFileSystemPath(fileUrl)} (${humanizeFileSize(
        Buffer.byteLength(coverageAsText),
      )})`,
    );
  }
};
