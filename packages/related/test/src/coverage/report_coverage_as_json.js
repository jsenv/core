import { urlToFileSystemPath } from "@jsenv/urls";
import { writeFileSync } from "@jsenv/filesystem";
import { byteAsFileSize } from "@jsenv/log";

export const reportCoverageAsJson = (testPlanResult, fileUrl) => {
  const testPlanCoverage = testPlanResult.coverage;
  if (!testPlanCoverage) {
    // TODO
  }
  const coverageAsText = JSON.stringify(testPlanCoverage, null, "  ");
  writeFileSync(fileUrl, coverageAsText);
  console.log(
    `-> ${urlToFileSystemPath(fileUrl)} (${byteAsFileSize(
      Buffer.byteLength(coverageAsText),
    )})`,
  );
};
