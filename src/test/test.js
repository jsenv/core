import { normalizePathname } from "@jsenv/module-resolution"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"

export const test = async ({
  importMap,
  projectFolder,
  compileInto,
  compileGroupCount,
  babelPluginDescription,
  executeDescription,
  maxParallelExecution,
  defaultAllocatedMsPerExecution,
}) =>
  catchAsyncFunctionCancellation(async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      importMap,
      projectFolder,
      compileInto,
      compileGroupCount,
      babelPluginDescription,
      executeDescription,
      defaultAllocatedMsPerExecution,
    })

    return executePlan(executionPlan, { cancellationToken, maxParallelExecution })
  })
