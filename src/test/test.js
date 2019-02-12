import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"

export const test = async ({
  root,
  compileInto,
  pluginMap,
  executeDescription,
  maxParallelExecution,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      root,
      compileInto,
      pluginMap,
      executeDescription,
    })

    return executePlan(executionPlan, { cancellationToken, maxParallelExecution })
  })
