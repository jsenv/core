import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "@dmail/cancellation"
import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { startCompileServerForTesting } from "./startCompileServerForTesting.js"
import { generateExecutionArray } from "./execution/generate-execution-array.js"
import { executeAll } from "./execution/execute-all.js"
import { executionIsPassed } from "./execution/execution-is-passed.js"

export const test = async ({
  projectPath,
  compileIntoRelativePath = "./.dist/",
  importMapRelativePath,
  importDefaultExtension,
  browserPlatformRelativePath,
  nodePlatformRelativePath,
  browserGroupResolverRelativePath,
  nodeGroupResolverRelativePath,
  executeDescription = {},
  compileGroupCount = 2,
  babelPluginMap,
  convertMap,
  updateProcessExitCode = true,
  throwUnhandled = true,
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",
  maxParallelExecution,
  defaultAllocatedMsPerExecution = 30000,
  captureConsole = true,
  measureDuration = true,
  measureTotalDuration = false,
  collectNamespace = false,
  cleanCompileInto,
}) => {
  const start = async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()
    const projectPathname = operatingSystemPathToPathname(projectPath)

    const [executionArray, { origin: compileServerOrigin }] = await Promise.all([
      generateExecutionArray(executeDescription, {
        cancellationToken,
        projectPathname,
      }),
      startCompileServerForTesting({
        cancellationToken,
        projectPath,
        compileIntoRelativePath,
        cleanCompileInto,
        importMapRelativePath,
        importDefaultExtension,
        browserPlatformRelativePath,
        nodePlatformRelativePath,
        browserGroupResolverRelativePath,
        nodeGroupResolverRelativePath,
        compileGroupCount,
        babelPluginMap,
        convertMap,
        logLevel: compileServerLogLevel,
      }),
    ])

    const executionResult = await executeAll(executionArray, {
      cancellationToken,
      compileServerOrigin,
      projectPath,
      compileIntoRelativePath,
      importMapRelativePath,
      importDefaultExtension,
      logLevel,
      launchLogLevel,
      executeLogLevel,
      maxParallelExecution,
      defaultAllocatedMsPerExecution,
      captureConsole,
      measureDuration,
      measureTotalDuration,
      collectNamespace,
    })
    if (updateProcessExitCode && !executionIsPassed(executionResult)) {
      process.exitCode = 1
    }
    return executionResult
  }

  const promise = catchAsyncFunctionCancellation(start)
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
