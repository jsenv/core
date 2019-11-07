import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "@dmail/cancellation"
import { pathToDirectoryUrl, resolveDirectoryUrl } from "./private/urlUtils.js"
import { startCompileServerForTesting } from "./private/testing/startCompileServerForTesting.js"
import { generateExecutionArray } from "./private/testing/generateExecutionArray.js"
import { executeAll } from "./private/testing/executeAll.js"
import { executionIsPassed } from "./private/testing/executionIsPassed.js"

export const executeTests = async ({
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",
  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist/",
  compileDirectoryClean,
  importMapFileRelativePath,
  importDefaultExtension,
  executeDescription = {},
  compileGroupCount = 2,
  babelPluginMap,
  convertMap,
  updateProcessExitCode = true,
  throwUnhandled = true,
  maxParallelExecution,
  defaultAllocatedMsPerExecution = 30000,
  captureConsole = true,
  measureDuration = true,
  measureTotalDuration = false,
  collectNamespace = false,
}) => {
  const start = async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()
    const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativePath,
      projectDirectoryUrl,
    )

    const [executionArray, { origin: compileServerOrigin }] = await Promise.all([
      generateExecutionArray(executeDescription, {
        cancellationToken,
        projectDirectoryUrl,
      }),
      startCompileServerForTesting({
        cancellationToken,
        logLevel: compileServerLogLevel,
        projectDirectoryUrl,
        compileDirectoryUrl,
        compileDirectoryClean,
        importMapFileRelativePath,
        importDefaultExtension,
        compileGroupCount,
        babelPluginMap,
        convertMap,
      }),
    ])

    const executionResult = await executeAll(executionArray, {
      cancellationToken,
      logLevel,
      compileServerOrigin,
      projectDirectoryUrl,
      compileDirectoryUrl,
      importMapFileRelativePath,
      importDefaultExtension,
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
