import { createDetailedMessage } from "@jsenv/logger"

export const composeV8AndIstanbul = (
  v8FileByFileCoverage,
  istanbulFileByFileCoverage,
  { coverageV8MergeConflictIsExpected },
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
      if (!coverageV8MergeConflictIsExpected) {
        // ideally when coverageV8MergeConflictIsExpected it would be a console.debug
        console.warn(
          createDetailedMessage(
            `Cannot merge file coverage from v8 and file coverage from istanbul, the istanbul coverage will be ignored`,
            {
              suggestion:
                "If this is expected use coverageV8MergeConflictIsExpected to disable this warning",
            },
          ),
        )
      }
      fileByFileCoverage[key] = v8FileByFileCoverage
    } else {
      fileByFileCoverage[key] = v8FileByFileCoverage[key]
    }
  })

  return fileByFileCoverage
}
