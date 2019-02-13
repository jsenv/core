import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"

export const test = async ({
  projectFolder,
  compileInto,
  babelPluginDescription,
  executeDescription,
  maxParallelExecution,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      projectFolder,
      compileInto,
      babelPluginDescription,
      executeDescription,
    })

    return executePlan(executionPlan, { cancellationToken, maxParallelExecution })
  })
