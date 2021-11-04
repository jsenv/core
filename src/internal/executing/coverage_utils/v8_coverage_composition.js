import { require } from "@jsenv/core/src/internal/require.js"

export const composeTwoV8Coverages = (firstV8Coverage, secondV8Coverage) => {
  const { mergeProcessCovs } = require("@c88/v8-coverage")

  // mergeCoverageReports do not preserves source-map-cache during the merge
  // so we store sourcemap cache now
  const sourceMapCache = {}
  const visit = (coverageReport) => {
    coverageReport.result.forEach((fileReport) => {
      if (fileReport["source-map-cache"]) {
        Object.assign(sourceMapCache, fileReport["source-map-cache"])
      }
    })
  }
  visit(firstV8Coverage)
  visit(secondV8Coverage)

  const v8Coverage = mergeProcessCovs([firstV8Coverage, secondV8Coverage])
  v8Coverage["source-map-cache"] = sourceMapCache
  return v8Coverage
}
