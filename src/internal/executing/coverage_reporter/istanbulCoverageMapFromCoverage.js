import { require } from "../../require.js"

export const istanbulCoverageMapFromCoverage = (coverage) => {
  const { createCoverageMap } = require("istanbul-lib-coverage")

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
