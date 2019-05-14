import { normalizePathname } from "@jsenv/module-resolution"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"
import {
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  DEFAULT_COMPILE_INTO,
  DEFAULT_BABEL_CONFIG_MAP,
  DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_NODE_GROUP_RESOLVER_FILENAME_RELATIVE,
  DEFAULT_EXECUTE_DESCRIPTION,
  DEFAULT_MAX_PARALLEL_EXECUTION,
} from "./test-constant.js"

export const test = async ({
  projectFolder,
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = DEFAULT_COMPILE_INTO,
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  browserGroupResolverFilenameRelative = DEFAULT_BROWSER_GROUP_RESOLVER_FILENAME_RELATIVE,
  nodeGroupResolverFilenameRelative = DEFAULT_NODE_GROUP_RESOLVER_FILENAME_RELATIVE,
  executeDescription = DEFAULT_EXECUTE_DESCRIPTION,
  compileGroupCount = 2,
  maxParallelExecution = DEFAULT_MAX_PARALLEL_EXECUTION,
  defaultAllocatedMsPerExecution = 20000,
  updateProcessExitCode = true,
  throwUnhandled = true,
  compileServerLogLevel = "off",
  executionLogLevel = "log",
  collectNamespace = false,
  measureDuration = true,
  captureConsole = true,
}) => {
  const start = async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      projectFolder,
      importMapFilenameRelative,
      compileInto,
      compileGroupCount,
      babelConfigMap,
      browserGroupResolverFilenameRelative,
      nodeGroupResolverFilenameRelative,
      executeDescription,
      defaultAllocatedMsPerExecution,
      compileServerLogLevel,
    })

    const { planResult, planResultSummary } = await executePlan(executionPlan, {
      cancellationToken,
      maxParallelExecution,
      logLevel: executionLogLevel,
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
