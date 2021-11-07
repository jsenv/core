import { require } from "@jsenv/core/src/internal/require.js"

export const composeTwoV8Coverages = (firstV8Coverage, secondV8Coverage) => {
  if (secondV8Coverage.result.length === 0) {
    return firstV8Coverage
  }

  const { mergeProcessCovs } = require("@c88/v8-coverage")
  // "mergeProcessCovs" do not preserves source-map-cache during the merge
  // so we store sourcemap cache now
  const sourceMapCache = {}
  const visit = (coverageReport) => {
    if (coverageReport["source-map-cache"]) {
      Object.assign(sourceMapCache, coverageReport["source-map-cache"])
    }
  }
  visit(firstV8Coverage)
  visit(secondV8Coverage)
  const v8Coverage = mergeProcessCovs([firstV8Coverage, secondV8Coverage])
  v8Coverage["source-map-cache"] = sourceMapCache

  return v8Coverage
}
