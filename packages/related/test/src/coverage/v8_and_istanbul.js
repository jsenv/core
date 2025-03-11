import { createDetailedMessage } from "@jsenv/humanize";

export const composeV8AndIstanbul = (
  v8FileByFileCoverage,
  istanbulFileByFileCoverage,
  { warn, v8ConflictWarning },
) => {
  const fileByFileCoverage = {};
  const v8Files = Object.keys(v8FileByFileCoverage);
  const istanbulFiles = Object.keys(istanbulFileByFileCoverage);

  v8Files.forEach((key) => {
    fileByFileCoverage[key] = v8FileByFileCoverage[key];
  });
  istanbulFiles.forEach((key) => {
    const v8Coverage = v8FileByFileCoverage[key];
    if (v8Coverage) {
      if (v8ConflictWarning) {
        warn({
          code: "V8_COVERAGE_CONFLICT",
          message: createDetailedMessage(
            `Coverage conflict on "${key}", found two coverage that cannot be merged together: v8 and istanbul. The istanbul coverage will be ignored.`,
            {
              "details": `This happens when a file is executed on a runtime using v8 coverage (node or chromium) and on runtime using istanbul coverage (firefox or webkit)`,
              "suggestion":
                "disable this warning with coverage.v8ConflictWarning: false",
              "suggestion 2": `force coverage using istanbul with coverage.methodForBrowsers: "istanbul"`,
            },
          ),
        });
      }
      fileByFileCoverage[key] = v8Coverage;
    } else {
      fileByFileCoverage[key] = istanbulFileByFileCoverage[key];
    }
  });

  return fileByFileCoverage;
};
