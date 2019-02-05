import { executePlan } from "../executePlan/index.js"
import { patternMappingToExecutionPlan } from "../patternMappingToExecutionPlan.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const test = catchAsyncFunctionCancellation(
  async ({ localRoot, compileInto, pluginMap, testPatternMapping }) => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await patternMappingToExecutionPlan({
      cancellationToken,
      localRoot,
      compileInto,
      pluginMap,
      patternMapping: testPatternMapping,
    })

    return executePlan(executionPlan, { cancellationToken })
  },
)
