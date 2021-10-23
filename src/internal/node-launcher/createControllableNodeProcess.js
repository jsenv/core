/* eslint-disable import/max-dependencies */
import { fork as forkChildProcess } from "node:child_process"

import { uneval } from "@jsenv/uneval"
import { createCancellationToken } from "@jsenv/cancellation"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import {
  urlToFileSystemPath,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/filesystem"

import { nodeSupportsDynamicImport } from "../runtime/node-feature-detect/nodeSupportsDynamicImport.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { require } from "../require.js"
import { createChildProcessOptions } from "./createChildProcessOptions.js"
import {
  processOptionsFromExecArgv,
  execArgvFromProcessOptions,
} from "./processOptions.js"

const nodeControllableFileUrl = resolveUrl(
  "./src/internal/node-launcher/nodeControllableFile.mjs",
  jsenvCoreDirectoryUrl,
)

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

export const createControllableNodeProcess = async ({
  cancellationToken = createCancellationToken(),
  logLevel,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  commandLineOptions = [],
  env,
  inheritProcessEnv = true,

  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe",
  logProcessCommand = false,
}) => {
  const logger = createLogger({ logLevel })
  const dynamicImportSupported = await nodeSupportsDynamicImport()
  if (!dynamicImportSupported) {
    throw new Error(`node does not support dynamic import`)
  }

  const childProcessOptions = await createChildProcessOptions({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
  })
  const processOptions = {
    ...childProcessOptions,
    ...processOptionsFromExecArgv(commandLineOptions),
  }
  const execArgv = execArgvFromProcessOptions(processOptions)

  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`)
  }

  await assertFilePresence(nodeControllableFileUrl)
  const childProcess = forkChildProcess(
    urlToFileSystemPath(nodeControllableFileUrl),
    {
      execArgv,
      // silent: true
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      env: {
        ...(inheritProcessEnv ? process.env : {}),
        ...env,
      },
    },
  )

  logger.debug(`fork child process pid ${childProcess.pid}
--- execArgv ---
${execArgv.join(`
`)}
--- custom env ---
${JSON.stringify(env, null, "  ")}`)

  // if we passe stream, pipe them https://github.com/sindresorhus/execa/issues/81
  if (typeof stdin === "object") {
    stdin.pipe(childProcess.stdin)
  }
  if (typeof stdout === "object") {
    childProcess.stdout.pipe(stdout)
  }
  if (typeof stderr === "object") {
    childProcess.stderr.pipe(stderr)
  }
  if (logProcessCommand) {
    console.log(
      `${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(
        nodeControllableFileUrl,
      )}`,
    )
  }

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
    return () => {
      const index = errorCallbackArray.indexOf(callback)
      if (index > -1) {
        errorCallbackArray.splice(index, 1)
      }
    }
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
    resolveDisconnect = () => {
      removeExitListener()
      removeDisconnectListener()
    }

    const removeDisconnectListener = onceProcessEvent(
      childProcess,
      "disconnect",
      () => {
        removeExitListener()
        resolve()
      },
    )

    const removeExitListener = onceProcessEvent(childProcess, "exit", () => {
      removeDisconnectListener()
      resolve()
    })
  })

  const disconnectChildProcess = async () => {
    try {
      childProcess.disconnect()
    } catch (e) {
      if (e.code === "ERR_IPC_DISCONNECTED") {
        resolveDisconnect()
      } else {
        throw e
      }
    }
    await disconnected
  }

  const killChildProcess = async ({ signal }) => {
    killing = true
    logger.debug(`send ${signal} to child process with pid ${childProcess.pid}`)

    await new Promise((resolve) => {
      const killProcessTree = require("tree-kill")
      killProcessTree(childProcess.pid, signal, (error) => {
        if (error) {
          // on windows: process with pid cannot be found
          if (
            error.stack.includes(`The process "${childProcess.pid}" not found`)
          ) {
            resolve()
            return
          }
          // on windows: child process with a pid cannot be found
          if (
            error.stack.includes(
              "Reason: There is no running instance of the task",
            )
          ) {
            resolve()
            return
          }
          // windows too
          if (
            error.stack.includes("The operation attempted is not supported")
          ) {
            resolve()
            return
          }

          logger.error(
            createDetailedMessage(
              `error while killing process tree with ${signal}`,
              {
                ["error stack"]: error.stack,
                ["process.pid"]: childProcess.pid,
              },
            ),
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
    // something is keeping it alive and it cannot be propely killed.
    // wait for the child process to disconnect by itself
    await disconnectChildProcess()
  }

  const stop = async ({ gracefulFailed } = {}) => {
    let unregisterErrorCallback
    await Promise.race([
      new Promise((resolve, reject) => {
        unregisterErrorCallback = registerErrorCallback(reject)
      }),
      killChildProcess({
        signal: gracefulFailed ? GRACEFUL_STOP_FAILED_SIGNAL : STOP_SIGNAL,
      }),
    ])
    unregisterErrorCallback()
  }

  const gracefulStop = async () => {
    let unregisterErrorCallback
    await Promise.race([
      new Promise((resolve, reject) => {
        unregisterErrorCallback = registerErrorCallback(reject)
      }),
      killChildProcess({ signal: GRACEFUL_STOP_SIGNAL }),
    ])
    unregisterErrorCallback()
  }

  const requestActionOnChildProcess = ({ actionType, actionParams }) => {
    return new Promise(async (resolve, reject) => {
      onceProcessMessage(childProcess, "action-result", ({ status, value }) => {
        logger.debug(
          createDetailedMessage(`child process sent an action result.`, {
            status,
            value: JSON.stringify(value, null, "  "),
          }),
        )
        if (status === "action-completed") {
          resolve(value)
        } else {
          reject(value)
        }
      })

      logger.debug(
        createDetailedMessage(`ask child process to perform an action`, {
          actionType,
          actionParams: JSON.stringify(actionParams, null, "  "),
        }),
      )

      await childProcessReadyPromise
      try {
        await sendToProcess(childProcess, "action", {
          actionType,
          actionParams,
        })
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

  return {
    execArgv,
    gracefulStop,
    stop,
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    requestActionOnChildProcess,
    onceChildProcessEvent: (event, callback) => {
      onceProcessEvent(childProcess, event, callback)
    },
  }
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
  const removeErrorListener = onceProcessMessage(
    childProcess,
    "error",
    errorListener,
  )
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
  const onmessage = (message) => {
    if (message.type === type) {
      childProcess.removeListener("message", onmessage)
      // eslint-disable-next-line no-eval
      callback(message.data ? eval(`(${message.data})`) : "")
    }
  }
  childProcess.on("message", onmessage)
  return () => {
    childProcess.removeListener("message", onmessage)
  }
}

const onceProcessEvent = (childProcess, type, callback) => {
  childProcess.once(type, callback)

  return () => {
    childProcess.removeListener(type, callback)
  }
}
