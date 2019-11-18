const { createFileCoverage } = import.meta.require("istanbul-lib-coverage")

// https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
export const composeCoverageMap = (...coverageMaps) => {
  const finalCoverageMap = {}
  coverageMaps.forEach((coverageMap) => {
    Object.keys(coverageMap).forEach((filename) => {
      const coverage = coverageMap[filename]
      finalCoverageMap[filename] =
        filename in finalCoverageMap ? merge(finalCoverageMap[filename], coverage) : coverage
    })
  })
  return finalCoverageMap
}

const merge = (coverageA, coverageB) => {
  const fileCoverage = createFileCoverage(coverageA)
  fileCoverage.merge(coverageB)
  return fileCoverage.toJSON()
}
