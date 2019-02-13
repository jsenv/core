import { createCancellationToken } from "@dmail/cancellation"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { fileToEmptyCoverage } from "./fileToEmptyCoverage.js"

// maybe we'll move this to the cover script instead of here
export const executionPlanResultToCoverageMap = async (
  executionPlanResult,
  { cancellationToken = createCancellationToken(), projectFolder, filesToCover = [] },
) => {
  // I think it is an error, it would be strange, for a given file
  // to be both covered and executed
  ensureNoFileIsBothCoveredAndExecuted({ filesToCover, executionPlanResult })

  const coverageMapArray = []
  Object.keys(executionPlanResult).forEach((file) => {
    const executionResultForFile = executionPlanResult[file]
    Object.keys(executionResultForFile).forEach((platformName) => {
      const executionResultForFileOnPlatform = executionResultForFile[platformName]
      const { coverageMap } = executionResultForFileOnPlatform
      if (!coverageMap) return
      coverageMapArray.push(coverageMap)
    })
  })
  const executionCoverageMap = coverageMapCompose(...coverageMapArray)

  const filesMissed = filesToCover.filter((file) => file in executionCoverageMap === false)

  const missedCoverageMap = {}
  await Promise.all(
    filesMissed.map(async (file) => {
      const emptyCoverage = await fileToEmptyCoverage(file, { cancellationToken, projectFolder })
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
    // exclude executed files
    if (file in executionPlanResult) return
    // exclude node module files
    if (file.indexOf("node_modules/") > -1) return

    coverageMap[file] = fullCoverageMap[file]
  })

  return coverageMap
}

const ensureNoFileIsBothCoveredAndExecuted = ({ filesToCover, executionPlanResult }) => {
  const fileToExecuteAndCover = filesToCover.find((file) => file in executionPlanResult)
  if (fileToExecuteAndCover)
    throw new Error(`${fileToExecuteAndCover} must be covered but was also executed`)
}
