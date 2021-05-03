import { require } from "../../require.js"

const { createCoverageMap } = require("istanbul-lib-coverage")

// https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
export const composeIstanbulCoverages = (...istanbulCoverages) => {
  const istanbulCoverageMap = createCoverageMap()
  istanbulCoverages.forEach((istanbulCoverage) => {
    istanbulCoverageMap.merge(istanbulCoverage)
  })

  const istanbulCoverageComposed = {}
  const coverageMap = istanbulCoverageMap.toJSON()
  Object.keys(coverageMap).forEach((key) => {
    istanbulCoverageComposed[key] = coverageMap[key].toJSON()
  })
  return istanbulCoverageComposed
}
