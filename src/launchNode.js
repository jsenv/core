import { Script } from "vm"

import { loggerToLogLevel } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { jsenvNodeSystemUrl } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import {
  readFile,
  writeDirectory,
  resolveUrl,
  urlToFileSystemPath,
  removeFileSystemNode,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"
import { coverageMapFromV8Coverage } from "./internal/executing/coverage/coverageMapFromV8Coverage.js"
import cuid from "cuid"

export const launchNode = async ({
  cancellationToken = createCancellationToken(),
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  defaultNodeModuleResolution,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  commandLineOptions = [],
  stdin,
  stdout,
  stderr,

  remap = true,
  collectCoverage = false,
  coverageConfig,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`)
  }

  defaultNodeModuleResolution =
    defaultNodeModuleResolution ||
    (await getDefaultNodeModuleResolutionFromProjectPackage(projectDirectoryUrl))

  env = {
    ...(env ? env : process.env),
    COVERAGE_ENABLED: collectCoverage,
    JSENV: true,
  }

  if (collectCoverage) {
    env.NODE_V8_COVERAGE = await getNodeV8CoverageDir({ projectDirectoryUrl })
  }

  commandLineOptions = ["--experimental-import-meta-resolve", ...commandLineOptions]

  const logLevel = loggerToLogLevel(logger)
  const controllableNodeProcess = await createControllableNodeProcess({
    cancellationToken,
    logLevel,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    env,
    commandLineOptions,
    stdin,
    stdout,
    stderr,
  })

  const executeFile = async (fileRelativeUrl, { collectCoverage, executionId }) => {
    const executeParams = {
      jsenvCoreDirectoryUrl,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      fileRelativeUrl,
      compileServerOrigin,
      defaultNodeModuleResolution,

      collectCoverage,
      coverageConfig,
      executionId,
      remap,
    }

    let executionResult = await controllableNodeProcess.evaluate(
      `
import { execute } from ${JSON.stringify(jsenvNodeSystemUrl)}

export default execute(${JSON.stringify(executeParams, null, "    ")})
`,
    )

    executionResult = transformExecutionResult(executionResult, {
      compileServerOrigin,
      projectDirectoryUrl,
    })

    if (collectCoverage) {
      const { NODE_V8_COVERAGE } = env
      if (executionResult.readCoverage === undefined) {
        executionResult.readCoverage = async () => {
          try {
            await controllableNodeProcess.stop()
            const coverageMap = await coverageMapFromV8Coverage({
              projectDirectoryUrl,
              NODE_V8_COVERAGE,
              coverageConfig,
            })
            return coverageMap
          } finally {
            removeFileSystemNode(NODE_V8_COVERAGE, {
              recursive: true,
            })
          }
        }
      } else {
        removeFileSystemNode(NODE_V8_COVERAGE, {
          recursive: true,
        })
      }
    }

    return executionResult
  }

  return {
    name: "node",
    version: process.version.slice(1),
    options: {
      execArgv: controllableNodeProcess.execArgv,
      // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,
    },
    gracefulStop: controllableNodeProcess.gracefulStop,
    stop: controllableNodeProcess.stop,
    disconnected: controllableNodeProcess.disconnected,
    registerErrorCallback: controllableNodeProcess.registerErrorCallback,
    registerConsoleCallback: controllableNodeProcess.registerConsoleCallback,
    executeFile,
  }
}

const getNodeV8CoverageDir = async ({ projectDirectoryUrl }) => {
  const v8CoverageDirectory = resolveUrl(`./coverage-v8/${cuid()}`, projectDirectoryUrl)
  await writeDirectory(v8CoverageDirectory, { allowUseless: true })
  return urlToFileSystemPath(v8CoverageDirectory)
}

const transformExecutionResult = (evaluateResult, { compileServerOrigin, projectDirectoryUrl }) => {
  const { status } = evaluateResult

  if (status === "errored") {
    const { exceptionSource, coverageMap } = evaluateResult
    const error = evalSource(exceptionSource)
    const errorTransformed = transformError(error, { compileServerOrigin, projectDirectoryUrl })
    return {
      status,
      error: errorTransformed,
      coverageMap,
    }
  }

  const { namespace, coverageMap } = evaluateResult
  return {
    status,
    namespace,
    coverageMap,
  }
}

const transformError = (error, { compileServerOrigin, projectDirectoryUrl }) => {
  if (!error) {
    return error
  }

  if (!(error instanceof Error)) {
    return error
  }

  const compileServerOriginRegexp = new RegExp(
    escapeRegexpSpecialCharacters(`${compileServerOrigin}/`),
    "g",
  )
  // const serverUrlRegExp = new RegExp(
  //   `(${escapeRegexpSpecialCharacters(`${compileServerOrigin}/`)}[^\\s]+)`,
  //   "g",
  // )
  error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl)
  error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl)
  // const projectDirectoryPath = urlToFileSystemPath(projectDirectoryUrl)
  // const projectDirectoryPathRegexp = new RegExp(
  //   `(?<!file:\/\/)${escapeRegexpSpecialCharacters(projectDirectoryPath)}`,
  //   "g",
  // )
  // error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  // error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  return error
}

const evalSource = (code, href) => {
  const script = new Script(code, { filename: href })
  return script.runInThisContext()
}

const getDefaultNodeModuleResolutionFromProjectPackage = async (projectDirectoryUrl) => {
  const packageJson = await readFile(new URL("package.json", projectDirectoryUrl), {
    as: "json",
  })
  if (packageJson.type === "module") {
    return "esm"
  }
  return "commonjs"
}
