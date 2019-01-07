import { createFileCoverage } from "istanbul-lib-coverage"

// https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
export const coverageMapCompose = (...coverageMaps) => {
  const finalCoverageMap = {}
  coverageMaps.forEach((coverageMap) => {
    Object.keys(coverageMap).forEach((file) => {
      const coverage = coverageMap[file]
      finalCoverageMap[file] =
        file in finalCoverageMap ? merge(finalCoverageMap[file], coverage) : coverage
    })
  })
  return finalCoverageMap
}

const merge = (coverageA, coverageB) => {
  const fileCoverage = createFileCoverage(coverageA)
  fileCoverage.merge(coverageB)
  return fileCoverage.toJSON()
}
