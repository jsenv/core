import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"
import { DEFAULT_EXECUTE_DESCRIPTION, DEFAULT_MAX_PARALLEL_EXECUTION } from "./test-constant.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS, LOG_LEVEL_OFF } from "../logger.js"

export const test = async ({
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  browserPlatformRelativePath,
  nodePlatformRelativePath,
  browserGroupResolverRelativePath,
  nodeGroupResolverRelativePath,
  globalThisHelperRelativePath,
  executeDescription = DEFAULT_EXECUTE_DESCRIPTION,
  compileGroupCount = 2,
  maxParallelExecution = DEFAULT_MAX_PARALLEL_EXECUTION,
  defaultAllocatedMsPerExecution = 30000,
  babelPluginMap,
  updateProcessExitCode = true,
  throwUnhandled = true,
  compileServerLogLevel = LOG_LEVEL_OFF,
  launchLogLevel = LOG_LEVEL_OFF,
  executionLogLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  collectNamespace = false,
  measureDuration = true,
  captureConsole = true,
}) => {
  const start = async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()
    const projectPathname = operatingSystemPathToPathname(projectPath)

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      projectPathname,
      compileIntoRelativePath,
      importMapRelativePath,
      importDefaultExtension,
      browserPlatformRelativePath,
      nodePlatformRelativePath,
      browserGroupResolverRelativePath,
      nodeGroupResolverRelativePath,
      globalThisHelperRelativePath,
      compileGroupCount,
      babelPluginMap,
      executeDescription,
      compileServerLogLevel,
    })

    const { planResult, planResultSummary } = await executePlan(executionPlan, {
      cancellationToken,
      maxParallelExecution,
      logLevel: executionLogLevel,
      defaultAllocatedMsPerExecution,
      launchLogLevel,
      measureDuration,
      captureConsole,
      collectNamespace,
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
