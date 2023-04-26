import { requireFromJsenv } from "@jsenv/core/src/helpers/require_from_jsenv.js"

export const istanbulCoverageMapFromCoverage = (coverage) => {
  const { createCoverageMap } = requireFromJsenv("istanbul-lib-coverage")

  const coverageAdjusted = {}
  Object.keys(coverage).forEach((key) => {
    coverageAdjusted[key.slice(2)] = {
      ...coverage[key],
      path: key.slice(2),
    }
  })

  const coverageMap = createCoverageMap(coverageAdjusted)
  return coverageMap
}
