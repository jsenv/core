/**
 *
 * The goal is to get an istanbul coverage from a list of coverage that are either
 * v8Coverage or istanbul coverage
 *
 */

import { composeV8Coverages } from "./composeV8Coverages.js"
import { composeIstanbulCoverages } from "./composeIstanbulCoverages.js"
import { istanbulCoverageFromV8Coverage } from "./istanbulCoverageFromV8Coverage.js"

export const istanbulCoverageFromCoverages = async (
  coverages,
  { projectDirectoryUrl, coverageV8MergeConflictIsExpected },
) => {
  const v8Coverages = []
  const istanbulCoverages = []

  coverages.forEach((coverage) => {
    if (coverage.result) {
      v8Coverages.push(coverage)
    } else {
      istanbulCoverages.push(coverage)
    }
  })

  const v8CoverageComposed = composeV8Coverages(v8Coverages)
  const istanbulCoverageComposed = composeIstanbulCoverages(istanbulCoverages)
  const istanbulCoverageFromV8CoverageComposed = await istanbulCoverageFromV8Coverage(
    v8CoverageComposed,
    {
      projectDirectoryUrl,
    },
  )
  const istanbulCoverage = composeIstanbulCoverages(
    [istanbulCoverageComposed, istanbulCoverageFromV8CoverageComposed],
    {
      coverageV8MergeConflictIsExpected,
    },
  )
  return istanbulCoverage
}
