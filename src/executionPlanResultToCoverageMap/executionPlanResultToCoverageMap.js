import { createCancellationToken } from "@dmail/cancellation"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { filenameRelativeToEmptyCoverage } from "./filenameRelativeToEmptyCoverage.js"

// maybe we'll move this to the cover script instead of here
export const executionPlanResultToCoverageMap = async (
  executionPlanResult,
  { cancellationToken = createCancellationToken(), projectFolder, arrayOfFilenameRelativeToCover },
) => {
  // I think it is an error, it would be strange, for a given file
  // to be both covered and executed
  ensureNoFileIsBothCoveredAndExecuted({ arrayOfFilenameRelativeToCover, executionPlanResult })

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

  const arrayOfFilenameRelativeMissingCoverage = arrayOfFilenameRelativeToCover.filter(
    (filenameRelative) => filenameRelative in executionCoverageMap === false,
  )

  const missedCoverageMap = {}
  await Promise.all(
    arrayOfFilenameRelativeMissingCoverage.map(async (filenameRelative) => {
      const emptyCoverage = await filenameRelativeToEmptyCoverage({
        cancellationToken,
        projectFolder,
        filenameRelative,
      })
      missedCoverageMap[filenameRelative] = emptyCoverage
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
  Object.keys(fullCoverageMap).forEach((filenameRelative) => {
    // exclude executed files
    if (filenameRelative in executionPlanResult) return
    // exclude node module files
    if (filenameRelative.indexOf("node_modules/") > -1) return

    coverageMap[filenameRelative] = fullCoverageMap[filenameRelative]
  })

  return coverageMap
}

const ensureNoFileIsBothCoveredAndExecuted = ({
  arrayOfFilenameRelativeToCover,
  executionPlanResult,
}) => {
  const fileToExecuteAndCover = arrayOfFilenameRelativeToCover.find(
    (filenameRelative) => filenameRelative in executionPlanResult,
  )
  if (fileToExecuteAndCover)
    throw new Error(`${fileToExecuteAndCover} must be covered but was also executed`)
}
