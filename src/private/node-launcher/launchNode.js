/* eslint-disable import/max-dependencies */
import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { createCancellationToken } from "@dmail/cancellation"
import { jsenvBabelPluginMap } from "../../jsenvBabelPluginMap.js"
import { fileUrlToPath, fileUrlToRelativePath, resolveFileUrl } from "../urlUtils.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"
import { evalSource } from "./evalSource.js"
import { createChildExecArgv } from "./createChildExecArgv.js"
import { assertFile } from "../filesystem-assertions.js"
import { generateNodeCommonJsBundle } from "./generateNodeCommonJsBundle.js"

const EVALUATION_STATUS_OK = "evaluation-ok"
const NODE_EXECUTE_CLIENT_RELATIVE_PATH = ".jsenv/node-execute.js"

export const launchNode = async ({
  cancellationToken = createCancellationToken(),
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryUrl,
  importMapFileRelativePath,
  importDefaultExtension,
  nodeControllableFileUrl = resolveFileUrl(
    "./src/private/node-launcher/nodeControllableFile.js",
    jsenvCoreDirectoryUrl,
  ),
  nodeExecuteTemplateFileUrl = resolveFileUrl(
    "./src/private/node-launcher/nodeExecuteFileTemplate.js",
    jsenvCoreDirectoryUrl,
  ),
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
  remap = true,
  traceWarnings = true,
  cover = false,
  env,
  logLevel = "off",
  babelPluginMap = jsenvBabelPluginMap,
}) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileDirectoryUrl !== "string") {
    throw new TypeError(`compileDirectoryUrl must be a string, got ${compileDirectoryUrl}`)
  }
  if (env === undefined) {
    env = { ...process.env }
  } else if (typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`)
  }

  const execArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    processExecArgv: process.execArgv,
    processDebugPort: process.debugPort,
  })
  if (traceWarnings && !execArgv.includes("--trace-warnings")) {
    execArgv.push("--trace-warnings")
  }

  env.COVERAGE_ENABLED = cover

  const nodeControllableFilePath = fileUrlToPath(nodeControllableFileUrl)
  await assertFile(nodeControllableFilePath)

  const nodeExecuteTemplateRelativeFilePath = fileUrlToPath(nodeExecuteTemplateFileUrl)
  await assertFile(nodeExecuteTemplateRelativeFilePath)

  const child = forkChildProcess(nodeControllableFilePath, {
    execArgv,
    // silent: true
    stdio: "pipe",
    env,
  })

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  child.stdout.on("data", (chunk) => {
    const text = String(chunk)
    consoleCallbackArray.forEach((callback) => {
      callback({
        type: "log",
        text,
      })
    })
  })
  child.stderr.on("data", (chunk) => {
    const text = String(chunk)
    consoleCallbackArray.forEach((callback) => {
      callback({
        type: "error",
        text,
      })
    })
  })

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }
  const emitError = (error) => {
    errorCallbackArray.forEach((callback) => {
      callback(error)
    })
  }
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const errorEventRegistration = registerChildEvent(child, "error", (error) => {
    errorEventRegistration.unregister()
    exitErrorRegistration.unregister()
    emitError(error)
  })
  // process.exit(1) from child
  const exitErrorRegistration = registerChildEvent(child, "exit", (code) => {
    if (code !== 0 && code !== null) {
      errorEventRegistration.unregister()
      exitErrorRegistration.unregister()
      emitError(createExitWithFailureCodeError(code))
    }
  })

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  const registerDisconnectCallback = (callback) => {
    const registration = registerChildEvent(child, "disconnect", () => {
      callback()
    })
    return () => {
      registration.unregister()
    }
  }

  const stop = () => {
    const disconnectedPromise = new Promise((resolve) => {
      const unregister = registerDisconnectCallback(() => {
        unregister()
        resolve()
      })
    })
    child.kill("SIGINT")
    return disconnectedPromise
  }

  const stopForce = () => {
    const disconnectedPromise = new Promise((resolve) => {
      const unregister = registerDisconnectCallback(() => {
        unregister()
        resolve()
      })
    })
    child.kill()
    return disconnectedPromise
  }

  const executeFile = async (
    fileRelativePath,
    { collectNamespace, collectCoverage, executionId },
  ) => {
    const execute = async () => {
      await generateNodeCommonJsBundle({
        projectDirectoryUrl,
        importDefaultExtension,
        importMapFileRelativePath,
        originalFileRelativePath: fileUrlToRelativePath(
          nodeExecuteTemplateFileUrl,
          projectDirectoryUrl,
        ),
        // not exactly because compiledFileRelativePath
        // doit contenir le chemin vers compileDirectoryUrl
        compiledFileRelativePath: NODE_EXECUTE_CLIENT_RELATIVE_PATH,
        babelPluginMap,
        logLevel,
      })

      return new Promise((resolve, reject) => {
        const evaluationResultRegistration = registerChildMessage(
          child,
          "evaluate-result",
          ({ status, value }) => {
            evaluationResultRegistration.unregister()
            if (status === EVALUATION_STATUS_OK) resolve(value)
            else reject(value)
          },
        )

        sendToChild(
          child,
          "evaluate",
          createNodeIIFEString({
            compileServerOrigin,
            projectDirectoryUrl,
            compileDirectoryUrl,
            fileRelativePath,
            collectNamespace,
            collectCoverage,
            executionId,
            remap,
          }),
        )
      })
    }

    const executionResult = await execute()
    const { status } = executionResult
    if (status === "errored") {
      const { exceptionSource, coverageMap } = executionResult
      return {
        status,
        error: evalException(exceptionSource, { compileServerOrigin, projectDirectoryUrl }),
        coverageMap,
      }
    }

    const { namespace, coverageMap } = executionResult
    return {
      status,
      namespace,
      coverageMap,
    }
  }

  return {
    name: "node",
    version: process.version.slice(1),
    options: { execArgv, env },
    stop,
    stopForce,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}

const evalException = (exceptionSource, { compileServerOrigin, projectDirectoryUrl }) => {
  const error = evalSource(exceptionSource)
  if (error && error instanceof Error) {
    const compileServerOriginRegexp = new RegExp(
      escapeRegexpSpecialCharacters(compileServerOrigin),
      "g",
    )
    error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl)
    error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl)

    const projectDirectoryPath = fileUrlToPath(projectDirectoryUrl)

    const projectDirectoryPathRegexp = new RegExp(
      escapeRegexpSpecialCharacters(`(?<!file:\/\/)${projectDirectoryPath}`),
      "g",
    )
    error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
    error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  }

  return error
}

const sendToChild = (child, type, data) => {
  const source = uneval(data, { functionAllowed: true })
  child.send({
    type,
    data: source,
  })
}

const registerChildMessage = (child, type, callback) => {
  return registerChildEvent(child, "message", (message) => {
    if (message.type === type) {
      // eslint-disable-next-line no-eval
      callback(eval(`(${message.data})`))
    }
  })
}

const registerChildEvent = (child, type, callback) => {
  child.on(type, callback)

  const unregister = () => {
    child.removeListener(type, callback)
  }

  const registration = {
    unregister,
  }
  return registration
}

const createExitWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  return new Error(`child exited with ${code}`)
}

const createNodeIIFEString = ({
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryUrl,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
  executionId,
  remap,
}) => `(() => {
  const {
    nodeExecuteFilePath,
    compileServerOrigin,
    projectDirectoryUrl,
    compileDirectoryUrl,
    fileRelativePath,
    collectNamespace,
    collectCoverage,
    executionId,
    remap
  } = ${JSON.stringify({
    nodeExecuteFilePath: fileUrlToPath(
      resolveFileUrl(NODE_EXECUTE_CLIENT_RELATIVE_PATH, compileDirectoryUrl),
    ),
    compileServerOrigin,
    projectDirectoryUrl,
    compileDirectoryUrl,
    fileRelativePath,
    collectNamespace,
    collectCoverage,
    executionId,
    remap,
  })})


  const { execute } = require(nodeExecuteFilePath)

  return execute({
    compileServerOrigin,
    projectDirectoryUrl,
    compileDirectoryUrl,
    fileRelativePath,
    collectNamespace,
    collectCoverage,
    executionId,
    remap
  })
})()`
