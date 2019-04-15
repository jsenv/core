import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"

export const test = async ({
  importMapFilenameRelative,
  projectFolder,
  compileInto,
  compileGroupCount = 2,
  babelConfigMap,
  executeDescription,
  maxParallelExecution,
  defaultAllocatedMsPerExecution,
  updateProcessExitCode = true,
  throwUnhandled = true,
}) => {
  const start = async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      importMapFilenameRelative,
      projectFolder,
      compileInto,
      compileGroupCount,
      babelConfigMap,
      executeDescription,
      defaultAllocatedMsPerExecution,
    })

    const { planResult, planResultSummary } = await executePlan(executionPlan, {
      cancellationToken,
      maxParallelExecution,
    })
    if (updateProcessExitCode) {
      if (planResultSummary.executionCount !== planResultSummary.completedCount) {
        process.exitCode = 1
      }
    }
    return { planResult, planResultSummary }
  }

  const promise = catchAsyncFunctionCancellation(start)
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
