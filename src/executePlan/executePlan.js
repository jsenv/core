import { createCancellationToken, createConcurrentOperations } from "@dmail/cancellation"
import { launchAndExecute } from "../launchAndExecute/index.js"
import { createFileExecutionResultLog, createPlanResultLog } from "./createExecutionLog.js"

export const executePlan = async (
  executionPlan,
  {
    cancellationToken = createCancellationToken(),
    cover = false,
    maxParallelExecution = 5,
    beforeEach = () => {},
    afterEach = (fileExecutionResult) => {
      console.log(createFileExecutionResultLog(fileExecutionResult))
    },
  } = {},
) => {
  const plannedExecutionArray = []
  Object.keys(executionPlan).forEach((file) => {
    const fileExecutionPlan = executionPlan[file]
    Object.keys(fileExecutionPlan).forEach((platformName) => {
      const { launch, allocatedMs } = fileExecutionPlan[platformName]
      plannedExecutionArray.push({
        file,
        platformName,
        launch,
        allocatedMs,
      })
    })
  })

  const planResult = {}
  await createConcurrentOperations({
    cancellationToken,
    maxParallelExecution,
    array: plannedExecutionArray,
    start: async ({ file, platformName, launch, allocatedMs }) => {
      beforeEach({ file, platformName })

      const result = await launchAndExecute(launch, file, {
        cancellationToken,
        allocatedMs,
        collectCoverage: cover,
        measureDuration: true,
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
      })
      afterEach({ file, platformName, allocatedMs, ...result })

      if (file in planResult === false) {
        planResult[file] = {}
      }
      planResult[file][platformName] = result

      // if (cover && result.value.coverageMap === null) {
      // coverageMap can be null for 2 reason:
      // - test file import a source file which is not instrumented
      // here we should throw
      // - test file import nothing so global__coverage__ is not set
      // here it's totally normal
      // throw new Error(`missing coverageMap after ${file} execution, it was not instrumented`)
      // }
    },
  })

  console.log(createPlanResultLog({ executionPlan, planResult }))

  return planResult
}
