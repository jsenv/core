import { require } from "../../require.js"

const { createFileCoverage } = require("istanbul-lib-coverage")

// https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
export const composeIstanbulCoverages = (...istanbulCoverages) => {
  const istanbulCoverageComposed = {}
  istanbulCoverages.forEach((istanbulCoverage) => {
    Object.keys(istanbulCoverage).forEach((filename) => {
      const fileCoverage = istanbulCoverage[filename]
      istanbulCoverageComposed[filename] =
        filename in istanbulCoverageComposed
          ? merge(istanbulCoverageComposed[filename], fileCoverage)
          : fileCoverage
    })
  })
  return istanbulCoverageComposed
}

const merge = (coverageA, coverageB) => {
  const fileCoverage = createFileCoverage(coverageA)
  fileCoverage.merge(coverageB)
  return fileCoverage.toJSON()
}
