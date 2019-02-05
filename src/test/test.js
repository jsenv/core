import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { patternMappingToExecutionPlan } from "../patternMappingToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"

export const test = async ({
  localRoot,
  compileInto,
  pluginMap,
  testPatternMapping,
  maxParallelExecution,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await patternMappingToExecutionPlan({
      cancellationToken,
      localRoot,
      compileInto,
      pluginMap,
      patternMapping: testPatternMapping,
    })

    return executePlan(executionPlan, { cancellationToken, maxParallelExecution })
  })
