import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"
import {
  TEST_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  TEST_DEFAULT_COMPILE_INTO,
  TEST_DEFAULT_EXECUTE_DESCRIPTION,
  TEST_DEFAULT_BABEL_CONFIG_MAP,
} from "./test-constant.js"

export const test = async ({
  projectFolder,
  babelConfigMap = TEST_DEFAULT_BABEL_CONFIG_MAP,
  importMapFilenameRelative = TEST_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = TEST_DEFAULT_COMPILE_INTO,
  executeDescription = TEST_DEFAULT_EXECUTE_DESCRIPTION,
  compileGroupCount = 2,
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
