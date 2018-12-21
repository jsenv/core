import { createCoverageMap } from "istanbul-lib-coverage"
import { objectComposeValue } from "../objectHelper.js"

export const coverageMapCompose = (...coverageMaps) => {
  return coverageMaps.reduce((previous, coverageMap) => {
    return {
      ...previous,
      ...objectComposeValue(previous, coverageMap, coverageMapMerge),
    }
  }, {})
}

const coverageMapMerge = (...coverageMaps) => {
  // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43
  const coverageMapMerged = coverageMaps.reduce(
    (previous, coverageMap) => previous.merge(coverageMap),
    createCoverageMap({}),
  )
  return coverageMapMerged.toJSON()
}
