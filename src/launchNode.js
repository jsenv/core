/* eslint-disable import/max-dependencies */
import { Script } from "vm"
import { fork as forkChildProcess } from "child_process"
import { uneval } from "@jsenv/uneval"
import { createCancellationToken } from "@jsenv/cancellation"
import { require } from "./internal/require.js"
import { supportsDynamicImport } from "./internal/supportsDynamicImport.js"
import { COMPILE_ID_COMMONJS_BUNDLE } from "./internal/CONSTANTS.js"
import { urlToFileSystemPath, resolveUrl, urlToRelativeUrl, assertFilePresence } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createChildExecArgv } from "./internal/node-launcher/createChildExecArgv.js"

const killProcessTree = require("tree-kill")

const EVALUATION_STATUS_OK = "evaluation-ok"

// https://nodejs.org/api/process.html#process_signal_events
const SIGINT_SIGNAL_NUMBER = 2
const SIGTERM_SIGNAL_NUMBER = 15
const SIGINT_EXIT_CODE = 128 + SIGINT_SIGNAL_NUMBER
const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL_NUMBER
// http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472
const GRACEFUL_STOP_SIGNAL = "SIGTERM"
const STOP_SIGNAL = "SIGKILL"
// it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL
const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL"

const nodeJsFileUrl = resolveUrl(
  "./src/internal/node-launcher/node-js-file.js",
  jsenvCoreDirectoryUrl,
)

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

  const execArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    traceWarnings,
    unhandledRejection,
    jsonModules,
  })

  env.COVERAGE_ENABLED = collectCoverage

  const childProcess = forkChildProcess(urlToFileSystemPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: "pipe",
    env,
  })
  logger.info(
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
  installProcessErrorListener(childProcess, (error) => {
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
    logger.debug(`send ${signal} to child process with pid ${childProcess.pid}`)

    await new Promise((resolve) => {
      killProcessTree(childProcess.pid, signal, (error) => {
        if (error) {
          // this error message occurs on windows
          if (error.message === `The process "${childProcess.pid}" not found`) {
            resolve()
          } else {
            logger.error(`error while killing process tree with ${signal}
    --- error stack ---
    ${error.stack}
    --- process.pid ---
    ${childProcess.pid}`)
          }
          // even if we could not kill the child
          // we will ask it to disconnect
          resolve()
        } else {
          resolve()
        }
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

  const executeFile = async (
    fileRelativeUrl,
    { collectNamespace, collectCoverage, executionId },
  ) => {
    const execute = async () => {
      return new Promise(async (resolve, reject) => {
        onceProcessMessage(childProcess, "evaluate-result", ({ status, value }) => {
          logger.debug(`child process sent the following evaluation result.
--- status ---
${status}
--- value ---
${value}`)
          if (status === EVALUATION_STATUS_OK) resolve(value)
          else reject(value)
        })

        const executeParams = {
          jsenvCoreDirectoryUrl,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          fileRelativeUrl,
          compileServerOrigin,

          collectNamespace,
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

        logger.debug(`ask child process to evaluate
--- source ---
${source}`)

        await childProcessReadyPromise
        try {
          await sendToProcess(childProcess, "evaluate", source)
        } catch (e) {
          logger.error(`error while sending message to child
--- error stack ---
${e.stack}`)
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
    options: { execArgv, env },
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

    error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl)
    error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl)

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
    if (code !== null && code !== 0 && code !== SIGINT_EXIT_CODE && code !== SIGTERM_EXIT_CODE) {
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
  return new Error(`child exited with ${code}`)
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

const generateSourceToEvaluate = async ({
  dynamicImportSupported,
  executeParams,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  if (dynamicImportSupported) {
    return `import { execute } from ${JSON.stringify(nodeJsFileUrl)}

export default execute(${JSON.stringify(executeParams, null, "    ")})`
  }

  const nodeJsFileRelativeUrl = urlToRelativeUrl(nodeJsFileUrl, projectDirectoryUrl)
  const nodeBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${nodeJsFileRelativeUrl}`
  const nodeBundledJsFileUrl = `${projectDirectoryUrl}${nodeBundledJsFileRelativeUrl}`
  const nodeBundledJsFileRemoteUrl = `${compileServerOrigin}/${nodeBundledJsFileRelativeUrl}`

  // The compiled nodePlatform file will be somewhere else in the filesystem
  // than the original nodePlatform file.
  // It is important for the compiled file to be able to require
  // node modules that original file could access
  // hence the requireCompiledFileAsOriginalFile
  return `(() => {
  const { readFileSync } = require("fs")
  const Module = require('module')
  const { dirname } = require("path")
  const { fetchUrl } = require("@jsenv/server")

  const run = async () => {
    try {
      await fetchUrl(${JSON.stringify(nodeBundledJsFileRemoteUrl)}, { ignoreHttpsError: true })
    }
    catch(e) {
      console.log('error while fetching', e)
      debugger
      return null
    }

    const nodeFilePath = ${JSON.stringify(urlToFileSystemPath(nodeJsFileUrl))}
    const nodeBundledJsFilePath = ${JSON.stringify(urlToFileSystemPath(nodeBundledJsFileUrl))}
    const { execute } = requireCompiledFileAsOriginalFile(nodeBundledJsFilePath, nodeFilePath)

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
