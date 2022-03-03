import { createDetailedMessage } from "@jsenv/logger"

export const composeV8AndIstanbul = (
  v8FileByFileCoverage,
  istanbulFileByFileCoverage,
  { coverageV8ConflictWarning },
) => {
  const fileByFileCoverage = {}
  const v8Files = Object.keys(v8FileByFileCoverage)
  const istanbulFiles = Object.keys(istanbulFileByFileCoverage)

  v8Files.forEach((key) => {
    fileByFileCoverage[key] = v8FileByFileCoverage[key]
  })
  istanbulFiles.forEach((key) => {
    const v8Coverage = v8FileByFileCoverage[key]
    if (v8Coverage) {
      if (coverageV8ConflictWarning) {
        console.warn(
          createDetailedMessage(
            `Coverage conflict on "${key}", found two coverage that cannot be merged together: v8 and istanbul. The istanbul coverage will be ignored.`,
            {
              "details": `This happens when a file is executed on a runtime using v8 coverage (node or chromium) and on runtime using istanbul coverage (firefox or webkit)`,
              "suggestion":
                "You can disable this warning with coverageV8ConflictWarning: false",
              "suggestion 2": `You can force usage of istanbul to prevent this conflict with coverageForceIstanbul: true`,
            },
          ),
        )
      }
      fileByFileCoverage[key] = v8Coverage
    } else {
      fileByFileCoverage[key] = istanbulFileByFileCoverage[key]
    }
  })

  return fileByFileCoverage
}
