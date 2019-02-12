import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"

export const test = async ({
  rootname,
  compileInto,
  pluginMap,
  executeDescription,
  maxParallelExecution,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      rootname,
      compileInto,
      pluginMap,
      executeDescription,
    })

    return executePlan(executionPlan, { cancellationToken, maxParallelExecution })
  })
