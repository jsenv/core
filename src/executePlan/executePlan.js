import { cpus } from "os"
import { createCancellationToken, createConcurrentOperations } from "@dmail/cancellation"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createExecutionPlanStartLog,
  createExecutionResultLog,
  createExecutionPlanSummaryMessage,
} from "./createExecutionLog.js"

export const executePlan = async (
  executionPlan,
  {
    cancellationToken = createCancellationToken(),
    cover = false,
    maxParallelExecution = Math.max(cpus.length - 1, 1),
    beforeEachExecutionCallback = () => {},
    afterEachExecutionCallback = (executionResult) => {
      console.log(createExecutionResultLog(executionResult))
    },
  } = {},
) => {
  const plannedExecutionArray = []
  Object.keys(executionPlan).forEach((filenameRelative) => {
    const fileExecutionPlan = executionPlan[filenameRelative]
    Object.keys(fileExecutionPlan).forEach((executionName) => {
      const { launch, allocatedMs } = fileExecutionPlan[executionName]
      plannedExecutionArray.push({
        launch,
        allocatedMs,
        executionName,
        filenameRelative,
      })
    })
  })

  console.log(createExecutionPlanStartLog({ executionPlan }))

  const planResult = {}
  await createConcurrentOperations({
    cancellationToken,
    maxParallelExecution,
    array: plannedExecutionArray,
    start: async ({ launch, allocatedMs, executionName, filenameRelative }) => {
      beforeEachExecutionCallback({ allocatedMs, executionName, filenameRelative })

      const result = await launchAndExecute({
        launch,
        cancellationToken,
        allocatedMs,
        measureDuration: true,
        collectPlatformNameAndVersion: true,
        // mirrorConsole: false because file will be executed in parallel
        // so log would be a mess to read
        mirrorConsole: false,
        // instead use captureConsole: true, we will wait for the file
        // to be executed before displaying the whole corresponding console output
        captureConsole: true,
        // stopOnError: true to ensure platform is stopped on error
        // because we know what we want: execution has failed
        // and we can use capturedConsole to know how it failed
        stopOnError: true,
        // stopOnceExecuted: true to ensure platform is stopped once executed
        // because we have what we wants: execution is completed and
        // we have associated coverageMap and capturedConsole
        stopOnceExecuted: true,
        // no need to log when disconnected
        disconnectAfterExecutedCallback: () => {},
        filenameRelative,
        collectCoverage: cover,
      })
      afterEachExecutionCallback({ allocatedMs, executionName, filenameRelative, ...result })

      if (filenameRelative in planResult === false) {
        planResult[filenameRelative] = {}
      }
      planResult[filenameRelative][executionName] = result
    },
  })

  const planResultSummary = planResultToSummary(planResult)

  console.log(createExecutionPlanSummaryMessage(planResultSummary))

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
