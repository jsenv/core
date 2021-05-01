import { Script } from "vm"

import { loggerToLogLevel } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { jsenvNodeSystemUrl } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"
import { readFile } from "@jsenv/util"

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

  const nodeProcess = await createControllableNodeProcess({
    cancellationToken,
    logLevel: loggerToLogLevel(logger),
    debugPort,
    debugMode,
    debugModeInheritBreak,
    env: {
      ...(env ? env : process.env),
      COVERAGE_ENABLED: collectCoverage,
      JSENV: true,
    },
    commandLineOptions: ["--experimental-import-meta-resolve", ...commandLineOptions],
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
      executionId,
      remap,
    }

    const result = await nodeProcess.evaluate(
      `
import { execute } from ${JSON.stringify(jsenvNodeSystemUrl)}

export default execute(${JSON.stringify(executeParams, null, "    ")})
`,
    )

    return transformExecutionResult(result, { compileServerOrigin, projectDirectoryUrl })
  }

  return {
    name: "node",
    version: process.version.slice(1),
    options: {
      execArgv: nodeProcess.execArgv,
      // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,
    },
    gracefulStop: nodeProcess.gracefulStop,
    stop: nodeProcess.stop,
    disconnected: nodeProcess.disconnected,
    registerErrorCallback: nodeProcess.registerErrorCallback,
    registerConsoleCallback: nodeProcess.registerConsoleCallback,
    executeFile,
  }
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
