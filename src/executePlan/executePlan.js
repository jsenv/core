import { cpus } from "os"
import {
  createCancellationToken,
  createConcurrentOperations,
} from "/node_modules/@dmail/cancellation/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createExecutionResultLog,
  createExecutionPlanSummaryMessage,
} from "./createExecutionLog.js"
import { createLogger, LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS, LOG_LEVEL_OFF } from "../logger.js"

export const executePlan = async (
  executionPlan,
  {
    cancellationToken = createCancellationToken(),
    collectCoverage = false,
    collectNamespace = false,
    measureDuration = true,
    captureConsole = true,
    defaultAllocatedMsPerExecution = 30000,
    maxParallelExecution = Math.max(cpus.length - 1, 1),
    beforeEachExecutionCallback = () => {},
    afterEachExecutionCallback = () => {},
    logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
    launchLogLevel = LOG_LEVEL_OFF,
  } = {},
) => {
  const { log } = createLogger({ logLevel })

  const plannedExecutionArray = []
  Object.keys(executionPlan).forEach((fileRelativePath) => {
    const fileExecutionPlan = executionPlan[fileRelativePath]
    Object.keys(fileExecutionPlan).forEach((executionName) => {
      const { launch, allocatedMs = defaultAllocatedMsPerExecution } = fileExecutionPlan[
        executionName
      ]
      plannedExecutionArray.push({
        launch,
        allocatedMs,
        executionName,
        fileRelativePath,
      })
    })
  })

  // console.log(createExecutionPlanStartLog({ executionPlan }))

  const planResult = {}
  await createConcurrentOperations({
    cancellationToken,
    maxParallelExecution,
    array: plannedExecutionArray,
    start: async ({ launch, allocatedMs, executionName, fileRelativePath }) => {
      beforeEachExecutionCallback({ allocatedMs, executionName, fileRelativePath })

      const result = await launchAndExecute({
        launch,
        cancellationToken,
        allocatedMs,
        measureDuration,
        logLevel: launchLogLevel,
        collectPlatformNameAndVersion: true,
        // mirrorConsole: false because file will be executed in parallel
        // so log would be a mess to read
        mirrorConsole: false,
        captureConsole,
        // stopOnceExecuted: true to ensure platform is stopped once executed
        // because we have what we wants: execution is completed and
        // we have associated coverageMap and capturedConsole
        stopOnceExecuted: true,
        // no need to log when disconnected
        disconnectAfterExecutedCallback: () => {},
        fileRelativePath,
        collectCoverage,
        collectNamespace,
      })
      const executionResult = { allocatedMs, executionName, fileRelativePath, ...result }
      afterEachExecutionCallback(executionResult)
      log(createExecutionResultLog(executionResult))

      if (fileRelativePath in planResult === false) {
        planResult[fileRelativePath] = {}
      }
      planResult[fileRelativePath][executionName] = result
    },
  })

  const planResultSummary = planResultToSummary(planResult)

  log(createExecutionPlanSummaryMessage(planResultSummary))

  return {
    planResult,
    planResultSummary,
  }
}

const planResultToSummary = (planResult) => {
  const fileNames = Object.keys(planResult)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(planResult[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = planResult[fileName]

      return (
        previous +
        Object.keys(fileExecutionResult).filter((executionName) => {
          const fileExecutionResultForPlatform = fileExecutionResult[executionName]
          return predicate(fileExecutionResultForPlatform)
        }).length
      )
    }, 0)
  }

  const disconnectedCount = countResultMatching(({ status }) => status === "disconnected")
  const timedoutCount = countResultMatching(({ status }) => status === "timedout")
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const completedCount = countResultMatching(({ status }) => status === "completed")

  return {
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  }
}
