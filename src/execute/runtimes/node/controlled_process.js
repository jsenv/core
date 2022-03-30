import { fork } from "node:child_process"
import { urlToFileSystemPath } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"
import {
  Abort,
  raceCallbacks,
  createCallbackListNotifiedOnce,
} from "@jsenv/abort"
import { uneval } from "@jsenv/uneval"

import { memoize } from "@jsenv/utils/memoize/memoize.js"

import { createChildExecOptions } from "./child_exec_options.js"
import { ExecOptions } from "./exec_options.js"
import { killProcessTree } from "./kill_process_tree.js"

const NODE_CONTROLLABLE_FILE_URL = new URL(
  "./controllable_file.mjs",
  import.meta.url,
).href

export const createControlledProcess = async ({
  signal = new AbortController().signal,
  logger,
  logProcessCommand = false,

  onStop,
  onError,
  onConsole,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  commandLineOptions = [],
  env,
  inheritProcessEnv = true,

  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe",
}) => {
  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`)
  }
  const cleanupCallbackList = createCallbackListNotifiedOnce()
  const cleanup = async (reason) => {
    await cleanupCallbackList.notify({ reason })
  }

  const childExecOptions = await createChildExecOptions({
    signal,
    debugPort,
    debugMode,
    debugModeInheritBreak,
  })
  const execArgv = ExecOptions.toExecArgv({
    ...childExecOptions,
    ...ExecOptions.fromExecArgv(commandLineOptions),
  })
  const envForChildProcess = {
    ...(inheritProcessEnv ? process.env : {}),
    ...env,
  }
  logger[logProcessCommand ? "info" : "debug"](
    `${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(
      NODE_CONTROLLABLE_FILE_URL,
    )}`,
  )
  const childProcess = fork(urlToFileSystemPath(NODE_CONTROLLABLE_FILE_URL), {
    execArgv,
    // silent: true
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: envForChildProcess,
  })
  logger.debug(
    createDetailedMessage(`child process forked (pid ${childProcess.pid})`, {
      "execArgv": execArgv.join(`\n`),
      "custom env": JSON.stringify(env, null, "  "),
    }),
  )
  // if we pass stream, pipe them https://github.com/sindresorhus/execa/issues/81
  if (typeof stdin === "object") {
    stdin.pipe(childProcess.stdin)
  }
  if (typeof stdout === "object") {
    childProcess.stdout.pipe(stdout)
  }
  if (typeof stderr === "object") {
    childProcess.stderr.pipe(stderr)
  }
  const childProcessReadyPromise = new Promise((resolve) => {
    onceProcessMessage(childProcess, "ready", resolve)
  })
  const removeOutputListener = installProcessOutputListener(
    childProcess,
    ({ type, text }) => {
      onConsole({ type, text })
    },
  )
  const stop = memoize(async ({ gracefulStopAllocatedMs } = {}) => {
    // all libraries are facing problem on windows when trying
    // to kill a process spawning other processes.
    // "killProcessTree" is theorically correct but sometimes keep process handing forever.
    // Inside GitHub workflow the whole Virtual machine gets unresponsive and ends up being killed
    // There is no satisfying solution to this problem so we stick to the basic
    // childProcess.kill()
    if (process.platform === "win32") {
      childProcess.kill()
      return
    }
    if (gracefulStopAllocatedMs) {
      try {
        await killProcessTree(childProcess.pid, {
          signal: GRACEFUL_STOP_SIGNAL,
          timeout: gracefulStopAllocatedMs,
        })
        return
      } catch (e) {
        if (e.code === "TIMEOUT") {
          logger.debug(
            `kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`,
          )
          await killProcessTree(childProcess.pid, {
            signal: GRACEFUL_STOP_FAILED_SIGNAL,
          })
          return
        }
        throw e
      }
    }
    await killProcessTree(childProcess.pid, { signal: STOP_SIGNAL })
    return
  })
  raceCallbacks(
    {
      // https://nodejs.org/api/child_process.html#child_process_event_disconnect
      // disconnect: (cb) => {
      //   return onceProcessEvent(childProcess, "disconnect", cb)
      // },
      // https://nodejs.org/api/child_process.html#child_process_event_error
      error: (cb) => {
        return onceProcessEvent(childProcess, "error", cb)
      },
      exit: (cb) => {
        return onceProcessEvent(childProcess, "exit", (code, signal) => {
          cb({ code, signal })
        })
      },
    },
    (winner) => {
      const raceEffects = {
        // disconnect: () => {
        //   stoppedCallbackList.notify()
        // },
        error: (error) => {
          removeOutputListener()
          if (
            !childProcess.connected &&
            error.code === "ERR_IPC_DISCONNECTED"
          ) {
            return
          }
          onError(error)
        },
        exit: async ({ code, signal }) => {
          // process.exit(1) in child process or process.exitCode = 1 + process.exit()
          // means there was an error even if we don't know exactly what.
          if (
            code !== null &&
            code !== 0 &&
            code !== SIGINT_EXIT_CODE &&
            code !== SIGTERM_EXIT_CODE &&
            code !== SIGABORT_EXIT_CODE
          ) {
            onError(createExitWithFailureCodeError(code))
          }
          await cleanup("process exit")
          onStop({ code, signal })
        },
      }
      raceEffects[winner.name](winner.data)
    },
  )
  const requestActionOnChildProcess = ({
    signal,
    actionType,
    actionParams,
  }) => {
    const actionOperation = Abort.startOperation()
    actionOperation.addAbortSignal(signal)
    return new Promise(async (resolve, reject) => {
      actionOperation.throwIfAborted()
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
        actionOperation.throwIfAborted()
        await sendToProcess(childProcess, "action", {
          actionType,
          actionParams,
        })
      } catch (e) {
        if (Abort.isAbortError(e) && actionOperation.signal.aborted) {
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
    stop,
    requestActionOnChildProcess,
  }
}

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
