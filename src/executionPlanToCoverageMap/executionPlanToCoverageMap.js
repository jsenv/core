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

  const coverageMapList = []
  Object.keys(result).forEach((file) => {
    Object.keys(result[file]).forEach((name) => {
      const { coverageMap } = result[file][name]
      if (coverageMap) {
        coverageMapList.push(coverageMap)
      }
    })
  })
  const executionCoverageMap = coverageMapCompose(...coverageMapList)

  const filesMissed = filesToCover.filter((file) => file in executionCoverageMap === false)

  const missedCoverageMap = {}
  await Promise.all(
    filesMissed.map(async (file) => {
      const emptyCoverage = await fileToEmptyCoverage(file, { cancellationToken, localRoot })
      missedCoverageMap[file] = emptyCoverage
      return emptyCoverage
    }),
  )

  const coverageMap = {
    ...executionCoverageMap,
    ...missedCoverageMap,
  }

  return coverageMap
}

const ensureNoFileIsBothCoveredAndExecuted = ({ filesToCover, executionPlan }) => {
  const fileToExecuteAndCover = filesToCover.find((file) => file in executionPlan)
  if (fileToExecuteAndCover)
    throw new Error(`${fileToExecuteAndCover} must be covered but is also part of execution plan`)
}
