import { readFileSync } from "node:fs";
import { Abort } from "@jsenv/abort";

import { filterV8Coverage } from "./v8_coverage.js";
import { readNodeV8CoverageDirectory } from "./v8_coverage_node_directory.js";
import { composeTwoV8Coverages } from "./v8_coverage_composition.js";
import { composeTwoFileByFileIstanbulCoverages } from "./istanbul_coverage_composition.js";
import { v8CoverageToIstanbul } from "./v8_coverage_to_istanbul.js";
import { composeV8AndIstanbul } from "./v8_and_istanbul.js";
import { normalizeFileByFileCoveragePaths } from "./file_by_file_coverage.js";
import { getMissingFileByFileCoverage } from "./missing_coverage.js";

export const generateCoverage = async (
  testPlanResult,
  { signal, logger, warn, rootDirectoryUrl, coverage },
) => {
  // collect v8 and istanbul coverage from executions
  let { v8Coverage, fileByFileIstanbulCoverage } =
    await getCoverageFromTestPlanResults(testPlanResult.results, {
      signal,
      onMissing: ({ file, executionResult, executionName }) => {
        // several reasons not to have coverage here:
        // 1. the file we executed did not import an instrumented file.
        // - a test file without import
        // - a test file importing only file excluded from coverage
        // - a coverDescription badly configured so that we don't realize
        // a file should be covered

        // 2. the file we wanted to executed timedout
        // - infinite loop
        // - too extensive operation
        // - a badly configured or too low allocatedMs for that execution.

        // 3. the file we wanted to execute contains syntax-error

        // in any scenario we are fine because
        // coverDescription will generate empty coverage for files
        // that were suppose to be coverage but were not.
        if (
          executionResult.status === "completed" &&
          executionResult.type === "node" &&
          coverage.methodForNodeJs !== "NODE_V8_COVERAGE"
        ) {
          warn({
            code: "EXECUTION_COVERAGE_FILE_NOT_FOUND",
            message: `"${executionName}" execution of ${file} did not properly write coverage into ${executionResult.coverageFileUrl}`,
          });
        }
      },
    });

  if (coverage.methodForNodeJs === "NODE_V8_COVERAGE") {
    await readNodeV8CoverageDirectory({
      logger,
      warn,
      signal,
      onV8Coverage: async (nodeV8Coverage) => {
        const nodeV8CoverageLight = await filterV8Coverage(nodeV8Coverage, {
          rootDirectoryUrl,
          coverageInclude: coverage.include,
        });
        v8Coverage = v8Coverage
          ? composeTwoV8Coverages(v8Coverage, nodeV8CoverageLight)
          : nodeV8CoverageLight;
      },
    });
  }

  // try to merge v8 with istanbul, if any
  let fileByFileCoverage;
  if (v8Coverage) {
    let v8FileByFileCoverage = await v8CoverageToIstanbul(v8Coverage, {
      signal,
    });

    v8FileByFileCoverage = normalizeFileByFileCoveragePaths(
      v8FileByFileCoverage,
      rootDirectoryUrl,
    );

    if (fileByFileIstanbulCoverage) {
      fileByFileIstanbulCoverage = normalizeFileByFileCoveragePaths(
        fileByFileIstanbulCoverage,
        rootDirectoryUrl,
      );
      fileByFileCoverage = composeV8AndIstanbul(
        v8FileByFileCoverage,
        fileByFileIstanbulCoverage,
        {
          warn,
          v8ConflictWarning: coverage.v8ConflictWarning,
        },
      );
    } else {
      fileByFileCoverage = v8FileByFileCoverage;
    }
  }
  // get istanbul only
  else if (fileByFileIstanbulCoverage) {
    fileByFileCoverage = normalizeFileByFileCoveragePaths(
      fileByFileIstanbulCoverage,
      rootDirectoryUrl,
    );
  }
  // no coverage found in execution (or zero file where executed)
  else {
    fileByFileCoverage = {};
  }

  // now add coverage for file not covered
  if (coverage.includeMissing) {
    const missingFileByFileCoverage = await getMissingFileByFileCoverage({
      signal,
      rootDirectoryUrl,
      coverageInclude: coverage.include,
      fileByFileCoverage,
    });
    Object.assign(
      fileByFileCoverage,
      normalizeFileByFileCoveragePaths(
        missingFileByFileCoverage,
        rootDirectoryUrl,
      ),
    );
  }

  return fileByFileCoverage;
};

const getCoverageFromTestPlanResults = async (
  executionResults,
  { signal, onMissing },
) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    let v8Coverage;
    let fileByFileIstanbulCoverage;

    // collect v8 and istanbul coverage from executions
    for (const file of Object.keys(executionResults)) {
      const executionResultForFile = executionResults[file];
      for (const executionName of Object.keys(executionResultForFile)) {
        operation.throwIfAborted();

        const executionResultForFileOnRuntime =
          executionResultForFile[executionName];
        const { coverageFileUrl } = executionResultForFileOnRuntime;
        let executionCoverage;
        try {
          executionCoverage = JSON.parse(
            String(readFileSync(new URL(coverageFileUrl))),
          );
        } catch (e) {
          if (e.code === "ENOENT" || e.name === "SyntaxError") {
            onMissing({
              executionName,
              file,
              executionResult: executionResultForFileOnRuntime,
            });
            continue;
          }
          throw e;
        }

        if (isV8Coverage(executionCoverage)) {
          v8Coverage = v8Coverage
            ? composeTwoV8Coverages(v8Coverage, executionCoverage)
            : executionCoverage;
        } else {
          fileByFileIstanbulCoverage = fileByFileIstanbulCoverage
            ? composeTwoFileByFileIstanbulCoverages(
                fileByFileIstanbulCoverage,
                executionCoverage,
              )
            : executionCoverage;
        }
      }
    }

    return {
      v8Coverage,
      fileByFileIstanbulCoverage,
    };
  } finally {
    await operation.end();
  }
};

const isV8Coverage = (coverage) => Boolean(coverage.result);
