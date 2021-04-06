/* eslint-disable import/max-dependencies */
import { Script } from "vm"
import { fork as forkChildProcess } from "child_process"
import { uneval } from "@jsenv/uneval"
import { createDetailedMessage } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { urlToFileSystemPath, resolveUrl, assertFilePresence } from "@jsenv/util"
import {
  jsenvNodeSystemUrl,
  jsenvNodeSystemBuildUrl,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { require } from "./internal/require.js"
import { supportsDynamicImport } from "./internal/supportsDynamicImport.js"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createChildExecArgv } from "./internal/node-launcher/createChildExecArgv.js"

const killProcessTree = require("tree-kill")

const EVALUATION_STATUS_OK = "evaluation-ok"

// https://nodejs.org/api/process.html#process_signal_events
const SIGINT_SIGNAL_NUMBER = 2
const SIGABORT_SIGNAL_NUMBER = 6
const SIGTERM_SIGNAL_NUMBER = 15
const SIGINT_EXIT_CODE = 128 + SIGINT_SIGNAL_NUMBER
const SIGABORT_EXIT_CODE = 128 + SIGABORT_SIGNAL_NUMBER
const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL_NUMBER
// http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472
const GRACEFUL_STOP_SIGNAL = "SIGTERM"
const STOP_SIGNAL = "SIGKILL"
// it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL
const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL"

export const launchNode = async ({
  cancellationToken = createCancellationToken(),
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  traceWarnings,
  unhandledRejection,
  jsonModules,
  env,
  commandLineOptions = [],

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
  if (env === undefined) {
    env = { ...process.env }
  } else if (typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`)
  }

  const dynamicImportSupported = await supportsDynamicImport()
  const nodeControllableFileUrl = resolveUrl(
    dynamicImportSupported
      ? "./src/internal/node-launcher/nodeControllableFile.js"
      : "./src/internal/node-launcher/nodeControllableFile.cjs",
    jsenvCoreDirectoryUrl,
  )
  await assertFilePresence(nodeControllableFileUrl)

  const childExecArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    traceWarnings,
    unhandledRejection,
    jsonModules,
  })
  const execArgv = [...childExecArgv, ...commandLineOptions]

  env.COVERAGE_ENABLED = collectCoverage
  env.JSENV = true

  const childProcess = forkChildProcess(urlToFileSystemPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: "pipe",
    env,
  })
  logger.debug(
    `${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(nodeControllableFileUrl)}`,
  )

  const childProcessReadyPromise = new Promise((resolve) => {
    onceProcessMessage(childProcess, "ready", resolve)
  })

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }
  installProcessOutputListener(childProcess, ({ type, text }) => {
    consoleCallbackArray.forEach((callback) => {
      callback({
        type,
        text,
      })
    })
  })
  // keep listening process outputs while child process is killed to catch
  // outputs until it's actually disconnected
  // registerCleanupCallback(removeProcessOutputListener)

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }
  let killing = false
  installProcessErrorListener(childProcess, (error) => {
    if (!childProcess.connected && error.code === "ERR_IPC_DISCONNECTED") {
      return
    }
    // on windows killProcessTree uses taskkill which seems to kill the process
    // with an exitCode of 1
    if (process.platform === "win32" && killing && error.exitCode === 1) {
      return
    }
    errorCallbackArray.forEach((callback) => {
      callback(error)
    })
  })
  // keep listening process errors while child process is killed to catch
  // errors until it's actually disconnected
  // registerCleanupCallback(removeProcessErrorListener)

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  let resolveDisconnect
  const disconnected = new Promise((resolve) => {
    resolveDisconnect = resolve
    onceProcessMessage(childProcess, "disconnect", () => {
      resolve()
    })
  })
  // child might exit without disconnect apparently, exit is disconnect for us
  childProcess.once("exit", () => {
    disconnectChildProcess()
  })

  const disconnectChildProcess = () => {
    try {
      childProcess.disconnect()
    } catch (e) {
      if (e.code === "ERR_IPC_DISCONNECTED") {
        resolveDisconnect()
      } else {
        throw e
      }
    }
    return disconnected
  }

  const killChildProcess = async ({ signal }) => {
    killing = true
    logger.debug(`send ${signal} to child process with pid ${childProcess.pid}`)

    await new Promise((resolve) => {
      killProcessTree(childProcess.pid, signal, (error) => {
        if (error) {
          // on windows: process with pid cannot be found
          if (error.stack.includes(`The process "${childProcess.pid}" not found`)) {
            resolve()
            return
          }
          // on windows: child process with a pid cannot be found
          if (error.stack.includes("Reason: There is no running instance of the task")) {
            resolve()
            return
          }
          // windows too
          if (error.stack.includes("The operation attempted is not supported")) {
            resolve()
            return
          }

          logger.error(
            createDetailedMessage(`error while killing process tree with ${signal}`, {
              ["error stack"]: error.stack,
              ["process.pid"]: childProcess.pid,
            }),
          )

          // even if we could not kill the child
          // we will ask it to disconnect
          resolve()
          return
        }

        resolve()
      })
    })

    // in case the child process did not disconnect by itself at this point
    // something is keeping it alive and it cannot be propely killed
    // disconnect it manually.
    // something inside makeProcessControllable.cjs ensure process.exit()
    // when the child process is disconnected.
    return disconnectChildProcess()
  }

  const stop = ({ gracefulFailed } = {}) => {
    return killChildProcess({
      signal: gracefulFailed ? GRACEFUL_STOP_FAILED_SIGNAL : STOP_SIGNAL,
    })
  }

  const gracefulStop = () => {
    return killChildProcess({ signal: GRACEFUL_STOP_SIGNAL })
  }

  const executeFile = async (fileRelativeUrl, { collectCoverage, executionId }) => {
    const execute = async () => {
      return new Promise(async (resolve, reject) => {
        onceProcessMessage(childProcess, "evaluate-result", ({ status, value }) => {
          logger.debug(
            createDetailedMessage(`child process sent the following evaluation result.`, {
              status,
              value,
            }),
          )
          if (status === EVALUATION_STATUS_OK) resolve(value)
          else reject(value)
        })

        const executeParams = {
          jsenvCoreDirectoryUrl,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          fileRelativeUrl,
          compileServerOrigin,

          collectCoverage,
          executionId,
          remap,
        }

        const source = await generateSourceToEvaluate({
          dynamicImportSupported,
          cancellationToken,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          executeParams,
        })

        logger.debug(
          createDetailedMessage(`ask child process to evaluate`, {
            source,
          }),
        )

        await childProcessReadyPromise
        try {
          await sendToProcess(childProcess, "evaluate", source)
        } catch (e) {
          logger.error(
            createDetailedMessage(`error while sending message to child`, {
              ["error stack"]: e.stack,
            }),
          )
          throw e
        }
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
    options: {
      execArgv,
      // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,
    },
    gracefulStop,
    stop,
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}

const evalException = (exceptionSource, { compileServerOrigin, projectDirectoryUrl }) => {
  const error = evalSource(exceptionSource)
  if (error && error instanceof Error) {
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
  }

  return error
}

const sendToProcess = async (childProcess, type, data) => {
  const source = uneval(data, { functionAllowed: true })

  return new Promise((resolve, reject) => {
    childProcess.send({ type, data: source }, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

const installProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = (chunk) => {
    callback({ type: "log", text: String(chunk) })
  }
  childProcess.stdout.on("data", stdoutDataCallback)

  const stdErrorDataCallback = (chunk) => {
    callback({ type: "error", text: String(chunk) })
  }
  childProcess.stderr.on("data", stdErrorDataCallback)

  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback)
    childProcess.stderr.removeListener("data", stdoutDataCallback)
  }
}

const installProcessErrorListener = (childProcess, callback) => {
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const errorListener = (error) => {
    removeExitListener() // if an error occured we ignore the child process exitCode
    callback(error)
    onceProcessMessage(childProcess, "error", errorListener)
  }
  const removeErrorListener = onceProcessMessage(childProcess, "error", errorListener)
  // process.exit(1) in child process or process.exitCode = 1 + process.exit()
  // means there was an error even if we don't know exactly what.
  const removeExitListener = onceProcessEvent(childProcess, "exit", (code) => {
    if (
      code !== null &&
      code !== 0 &&
      code !== SIGINT_EXIT_CODE &&
      code !== SIGTERM_EXIT_CODE &&
      code !== SIGABORT_EXIT_CODE
    ) {
      removeErrorListener()
      callback(createExitWithFailureCodeError(code))
    }
  })
  return () => {
    removeErrorListener()
    removeExitListener()
  }
}

const createExitWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  const error = new Error(`child exited with ${code}`)
  error.exitCode = code
  return error
}

const onceProcessMessage = (childProcess, type, callback) => {
  return onceProcessEvent(childProcess, "message", (message) => {
    if (message.type === type) {
      // eslint-disable-next-line no-eval
      callback(message.data ? eval(`(${message.data})`) : "")
    }
  })
}

const onceProcessEvent = (childProcess, type, callback) => {
  childProcess.on(type, callback)

  return () => {
    childProcess.removeListener(type, callback)
  }
}

const generateSourceToEvaluate = async ({ dynamicImportSupported, executeParams }) => {
  if (dynamicImportSupported) {
    return `import { execute } from ${JSON.stringify(jsenvNodeSystemUrl)}

export default execute(${JSON.stringify(executeParams, null, "    ")})`
  }

  // The compiled nodeRuntime file will be somewhere else in the filesystem
  // than the original nodeRuntime file.
  // It is important for the compiled file to be able to require
  // node modules that original file could access
  // hence the requireCompiledFileAsOriginalFile
  return `(() => {
  const { readFileSync } = require("fs")
  const Module = require('module')
  const { dirname } = require("path")

  const run = async () => {
    const nodeFilePath = ${JSON.stringify(urlToFileSystemPath(jsenvNodeSystemBuildUrl))}
    const { execute } = requireCompiledFileAsOriginalFile(nodeFilePath, nodeFilePath)

    return execute(${JSON.stringify(executeParams, null, "    ")})
  }

  const requireCompiledFileAsOriginalFile = (compiledFilePath, originalFilePath) => {
    const fileContent = String(readFileSync(compiledFilePath))
    const moduleObject = new Module(compiledFilePath)
    moduleObject.paths = Module._nodeModulePaths(dirname(originalFilePath))
    moduleObject._compile(fileContent, compiledFilePath)
    return moduleObject.exports
  }

  return {
    default: run()
  }
})()`
}

const evalSource = (code, href) => {
  const script = new Script(code, { filename: href })
  return script.runInThisContext()
}
