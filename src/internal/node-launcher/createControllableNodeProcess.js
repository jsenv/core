import { fork } from "node:child_process"
import { uneval } from "@jsenv/uneval"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import {
  urlToFileSystemPath,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/filesystem"

import { Abortable } from "@jsenv/core/src/abort/main.js"
import { raceCallbacks } from "@jsenv/core/src/abort/callback_race.js"
import { createSignal } from "@jsenv/core/src/signal/signal.js"
import { nodeSupportsDynamicImport } from "../runtime/node-feature-detect/nodeSupportsDynamicImport.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { createChildProcessOptions } from "./createChildProcessOptions.js"
import {
  processOptionsFromExecArgv,
  execArgvFromProcessOptions,
} from "./processOptions.js"
import { killProcessTree } from "./kill_process_tree.js"

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
  signal = new AbortController().signal,
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
    signal,
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
  const envForChildProcess = {
    ...(inheritProcessEnv ? process.env : {}),
    ...env,
  }
  const childProcess = fork(urlToFileSystemPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: envForChildProcess,
  })

  logger.debug(
    createDetailedMessage(`fork child process pid ${childProcess.pid}`, {
      "execArgv": execArgv.join(`\n`),
      "custom env": JSON.stringify(env, null, "  "),
    }),
  )

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

  const outputSignal = createSignal()
  const removeOutputListener = installProcessOutputListener(
    childProcess,
    ({ type, text }) => {
      outputSignal.emit({ type, text })
    },
  )

  const errorSignal = createSignal()
  const removeErrorListener = installProcessErrorListener(
    childProcess,
    (error) => {
      removeOutputListener()
      if (!childProcess.connected && error.code === "ERR_IPC_DISCONNECTED") {
        return
      }
      errorSignal.transmit(error)
    },
  )
  // keep listening process errors while child process is killed to catch
  // errors until it's actually disconnected
  // registerCleanupCallback(removeProcessErrorListener)

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  const stoppedSignal = createSignal({
    once: true,
  })
  raceCallbacks(
    {
      disconnect: (cb) => {
        return onceProcessEvent(childProcess, "disconnect", cb)
      },
      exit: (cb) => {
        return onceProcessEvent(childProcess, "exit", (code, signal) => {
          cb({ code, signal })
        })
      },
    },
    (winner) => {
      const raceEffects = {
        disconnect: () => {
          removeErrorListener()
          stoppedSignal.emit()
        },
        exit: ({ code, signal }) => {
          removeErrorListener()
          stoppedSignal.emit({ code, signal })
        },
      }
      raceEffects[winner.name](winner.value)
    },
  )

  const stop = async ({ gracefulStopAllocatedMs } = {}) => {
    if (stoppedSignal.emitted) {
      return {}
    }

    const createStoppedPromise = async () => {
      if (stoppedSignal.emitted) {
        return
      }
      await new Promise((resolve) => stoppedSignal.addCallback(resolve))
    }

    if (gracefulStopAllocatedMs) {
      try {
        await killProcessTree(childProcess.pid, {
          signal: GRACEFUL_STOP_SIGNAL,
          timeout: gracefulStopAllocatedMs,
        })
        await createStoppedPromise()
        return { graceful: true }
      } catch (e) {
        if (e.code === "TIMEOUT") {
          logger.debug(
            `kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`,
          )
          await killProcessTree(childProcess.pid, {
            signal: GRACEFUL_STOP_FAILED_SIGNAL,
          })
          await createStoppedPromise()
          return { graceful: false }
        }
        throw e
      }
    }

    await killProcessTree(childProcess.pid, { signal: STOP_SIGNAL })
    await createStoppedPromise()
    return { graceful: false }
  }

  const requestActionOnChildProcess = ({
    signal,
    actionType,
    actionParams,
  }) => {
    const actionAbortable = Abortable.fromSignal(signal)

    return new Promise(async (resolve, reject) => {
      Abortable.throwIfAborted(actionAbortable)
      await childProcessReadyPromise

      onceProcessMessage(childProcess, "action-result", ({ status, value }) => {
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

      try {
        Abortable.throwIfAborted(actionAbortable)
        await sendToProcess(childProcess, "action", {
          actionType,
          actionParams,
        })
      } catch (e) {
        if (actionAbortable.signal.aborted && e.name === "AbortError") {
          throw e
        }
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
    stoppedSignal,
    errorSignal,
    outputSignal,
    stop,
    requestActionOnChildProcess,
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
  const removeErrorListener = onceProcessMessage(
    childProcess,
    "error",
    (error) => {
      removeExitListener() // if an error occured we ignore the child process exitCode
      callback(error)
    },
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
