import { executePlan } from "./executePlan.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { fileToEmptyCoverage } from "./fileToEmptyCoverage.js"

export const executionPlanToCoverageMap = async (
  executionPlan,
  { cancellationToken, localRoot, filesToCover = [] },
) => {
  // I think it is an error, it would be strange, for a given file
  // to be both covered and executed
  ensureNoFileIsBothCoveredAndExecuted({ filesToCover, executionPlan })

  const result = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
  })

  const coverageMapArray = []
  Object.keys(result).forEach((file) => {
    const fileResult = result[file]
    Object.keys(fileResult).forEach((name) => {
      const { coverageMap } = fileResult[name]
      if (coverageMap) {
        coverageMapArray.push(coverageMap)
      }
    })
  })
  const executionCoverageMap = coverageMapCompose(...coverageMapArray)

  const filesMissed = filesToCover.filter((file) => file in executionCoverageMap === false)

  const missedCoverageMap = {}
  await Promise.all(
    filesMissed.map(async (file) => {
      const emptyCoverage = await fileToEmptyCoverage(file, { cancellationToken, localRoot })
      missedCoverageMap[file] = emptyCoverage
      return emptyCoverage
    }),
  )

  const fullCoverageMap = {
    ...executionCoverageMap,
    ...missedCoverageMap,
  }

  // all file in the executionPlan must not be in the coverage object
  // we could also ensure that by not instrumenting theses files
  // but it's way more simple to instrument everything under
  // instrumented folder and exclude them from coverage here
  const coverageMap = {}
  Object.keys(fullCoverageMap).forEach((file) => {
    if (file in executionPlan) return
    coverageMap[file] = fullCoverageMap[file]
  })

  return coverageMap
}

const ensureNoFileIsBothCoveredAndExecuted = ({ filesToCover, executionPlan }) => {
  const fileToExecuteAndCover = filesToCover.find((file) => file in executionPlan)
  if (fileToExecuteAndCover)
    throw new Error(`${fileToExecuteAndCover} must be covered but is also part of execution plan`)
}
