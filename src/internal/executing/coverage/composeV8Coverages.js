import { require } from "@jsenv/core/src/internal/require.js"

const { mergeProcessCovs } = require("@c88/v8-coverage")

export const composeV8Coverages = (v8Coverages) => {
  // mergeCoverageReports do not preserves source-map-cache during the merge
  // so we store sourcemap cache now
  const sourceMapCache = {}
  v8Coverages.forEach((coverageReport) => {
    coverageReport.result.forEach((fileReport) => {
      if (fileReport["source-map-cache"]) {
        Object.assign(sourceMapCache, fileReport["source-map-cache"])
      }
    })
  })

  const v8Coverage = mergeProcessCovs(v8Coverages)
  v8Coverage["source-map-cache"] = sourceMapCache
  return v8Coverage
}
