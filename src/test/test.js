import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import { executePlan } from "../executePlan/index.js"
import { operatingSystemFilenameToPathname } from "../operating-system-filename.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_EXECUTE_DESCRIPTION,
  DEFAULT_MAX_PARALLEL_EXECUTION,
  DEFAULT_BABEL_CONFIG_MAP,
} from "./test-constant.js"

export const test = async ({
  projectFolder,
  compileFolderRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  browserGroupResolverRelativePath = DEFAULT_BROWSER_GROUP_RESOLVER_RELATIVE_PATH,
  nodeGroupResolverRelativePath = DEFAULT_NODE_GROUP_RESOLVER_RELATIVE_PATH,
  executeDescription = DEFAULT_EXECUTE_DESCRIPTION,
  compileGroupCount = 2,
  maxParallelExecution = DEFAULT_MAX_PARALLEL_EXECUTION,
  defaultAllocatedMsPerExecution = 20000,
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  updateProcessExitCode = true,
  throwUnhandled = true,
  compileServerLogLevel = "off",
  executionLogLevel = "log",
  collectNamespace = false,
  measureDuration = true,
  captureConsole = true,
}) => {
  const start = async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()
    const projectFolderPathname = operatingSystemFilenameToPathname(projectFolder)

    const executionPlan = await executeDescriptionToExecutionPlan({
      cancellationToken,
      projectFolderPathname,
      compileFolderRelativePath,
      importMapRelativePath,
      browserGroupResolverRelativePath,
      nodeGroupResolverRelativePath,
      compileGroupCount,
      babelConfigMap,
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
