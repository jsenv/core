import { createFileCoverage } from "istanbul-lib-coverage"
import { createCancellationToken, createConcurrentOperations } from "@dmail/cancellation"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createExecutionPlanStartLog,
  createExecutionResultLog,
  createExecutionPlanResultLog,
} from "./createExecutionLog.js"

export const executePlan = async (
  executionPlan,
  {
    cancellationToken = createCancellationToken(),
    cover = false,
    maxParallelExecution = 5,
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
      if (
        cover &&
        result.status === "errored" &&
        result.error &&
        result.error.code === "MODULE_PARSE_ERROR"
      ) {
        const fileCoverage = createFileCoverage(result.error.fileName)
        result.coverageMap = { [result.error.fileName]: fileCoverage.toJSON() }
      }
      afterEachExecutionCallback({ allocatedMs, executionName, filenameRelative, ...result })

      if (filenameRelative in planResult === false) {
        planResult[filenameRelative] = {}
      }
      planResult[filenameRelative][executionName] = result
    },
  })

  console.log(createExecutionPlanResultLog({ executionPlan, planResult }))

  return planResult
}
