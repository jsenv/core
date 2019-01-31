import {
  createCancellationSource,
  createCancellationToken,
  cancellationTokenCompose,
} from "@dmail/cancellation"
import { executePlan } from "../executePlan/index.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { fileToEmptyCoverage } from "./fileToEmptyCoverage.js"
import { createFileExecutionResultLog, createExecutionResultLog } from "./createExecutionLog.js"

export const executionPlanToCoverageMap = async (
  executionPlan,
  {
    cancellationToken = createCancellationToken(),
    localRoot,
    filesToCover = [],
    cancelSIGINT = true,
  },
) => {
  // I think it is an error, it would be strange, for a given file
  // to be both covered and executed
  ensureNoFileIsBothCoveredAndExecuted({ filesToCover, executionPlan })

  if (cancelSIGINT) {
    const SIGINTCancelSource = createCancellationSource()
    process.on("SIGINT", () => SIGINTCancelSource.cancel("process interruption"))
    cancellationToken = cancellationTokenCompose(cancellationToken, SIGINTCancelSource.token)
  }

  const allExecutionResult = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
    cancelSIGINT: false, // already handled by this one
    afterEach: (fileExecutionResult) => {
      console.log(createFileExecutionResultLog(fileExecutionResult))
    },
  })

  console.log(createExecutionResultLog({ executionPlan, executionResult: allExecutionResult }))

  const coverageMapArray = []
  Object.keys(allExecutionResult).forEach((file) => {
    const allExecutionResultForFile = allExecutionResult[file]
    Object.keys(allExecutionResultForFile).forEach((executionName) => {
      const executionResult = allExecutionResultForFile[executionName]
      if (!executionResult.status === "completed") return
      const { coverageMap } = executionResult.value
      if (!coverageMap) return
      coverageMapArray.push(coverageMap)
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

    // oh yeah we should also exclude node_modules files
    coverageMap[file] = fullCoverageMap[file]
  })

  return coverageMap
}

const ensureNoFileIsBothCoveredAndExecuted = ({ filesToCover, executionPlan }) => {
  const fileToExecuteAndCover = filesToCover.find((file) => file in executionPlan)
  if (fileToExecuteAndCover)
    throw new Error(`${fileToExecuteAndCover} must be covered but is also part of execution plan`)
}
