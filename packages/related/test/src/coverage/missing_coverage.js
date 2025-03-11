import { Abort } from "@jsenv/abort";

import { relativeUrlToEmptyCoverage } from "./empty_coverage_factory.js";
import { listRelativeFileUrlToCover } from "./list_files_not_covered.js";

export const getMissingFileByFileCoverage = async ({
  signal,
  rootDirectoryUrl,
  coverageInclude,
  fileByFileCoverage,
}) => {
  const relativeUrlsToCover = await listRelativeFileUrlToCover({
    signal,
    rootDirectoryUrl,
    coverageInclude,
  });
  const relativeUrlsMissing = relativeUrlsToCover.filter((relativeUrlToCover) =>
    Object.keys(fileByFileCoverage).every((key) => {
      return key !== `./${relativeUrlToCover}`;
    }),
  );

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  const missingFileByFileCoverage = {};
  await relativeUrlsMissing.reduce(async (previous, relativeUrlMissing) => {
    operation.throwIfAborted();
    await previous;
    await operation.withSignal(async (signal) => {
      const emptyCoverage = await relativeUrlToEmptyCoverage(
        relativeUrlMissing,
        {
          signal,
          rootDirectoryUrl,
        },
      );
      missingFileByFileCoverage[`./${relativeUrlMissing}`] = emptyCoverage;
    });
  }, Promise.resolve());
  return missingFileByFileCoverage;
};
