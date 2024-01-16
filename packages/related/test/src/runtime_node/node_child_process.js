import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Abort, raceCallbacks } from "@jsenv/abort";
import { createDetailedMessage } from "@jsenv/humanize";
import { memoize } from "@jsenv/utils/src/memoize/memoize.js";

import { createChildExecOptions } from "./child_exec_options.js";
import { ExecOptions } from "./exec_options.js";
import { killProcessTree } from "./kill_process_tree.js";
import { EXIT_CODES } from "./exit_codes.js";
import { IMPORTMAP_NODE_LOADER_FILE_URL } from "./importmap_node_loader_file_url.js";
import { NO_EXPERIMENTAL_WARNING_FILE_URL } from "./no_experimental_warnings_file_url.js";

const CONTROLLED_CHILD_PROCESS_URL = new URL(
  "./node_child_process_controlled.mjs?entry_point",
  import.meta.url,
).href;

export const nodeChildProcess = ({
  logProcessCommand = false,
  importMap,
  gracefulStopAllocatedMs = 4000,
  env,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  inheritProcessEnv = true,
  commandLineOptions = [],
  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe",
} = {}) => {
  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`);
  }
  env = {
    ...env,
    JSENV: true,
  };

  return {
    type: "node",
    name: "node_child_process",
    version: process.version.slice(1),
    run: async ({
      signal = new AbortController().signal,
      logger,

      rootDirectoryUrl,
      fileRelativeUrl,

      keepRunning,
      stopSignal,
      onConsole,
      onRuntimeStarted,
      onRuntimeStopped,

      measureMemoryUsage,
      onMeasureMemoryAvailable,
      collectConsole = false,
      collectPerformance,
      coverageEnabled = false,
      coverageInclude,
      coverageMethodForNodeJs,
      coverageFileUrl,
    }) => {
      if (coverageMethodForNodeJs !== "NODE_V8_COVERAGE") {
        env.NODE_V8_COVERAGE = "";
      }
      commandLineOptions = [
        "--experimental-import-meta-resolve",
        ...commandLineOptions,
      ];
      if (onMeasureMemoryAvailable) {
        env.MEASURE_MEMORY_AT_START = "1";
      }
      if (measureMemoryUsage || onMeasureMemoryAvailable) {
        if (!commandLineOptions.includes("--expose-gc")) {
          commandLineOptions.push("--expose-gc");
        }
      }
      if (importMap) {
        env.IMPORT_MAP = JSON.stringify(importMap);
        env.IMPORT_MAP_BASE_URL = rootDirectoryUrl;
        commandLineOptions.push(
          `--experimental-loader=${IMPORTMAP_NODE_LOADER_FILE_URL}`,
        );
        commandLineOptions.push(
          `--require=${fileURLToPath(NO_EXPERIMENTAL_WARNING_FILE_URL)}`,
        );
      }

      const cleanupCallbackSet = new Set();
      const cleanup = async (reason) => {
        const promises = [];
        for (const cleanupCallback of cleanupCallbackSet) {
          promises.push(cleanupCallback({ reason }));
        }
        cleanupCallbackSet.clear();
        await Promise.all(promises);
      };

      const childExecOptions = await createChildExecOptions({
        signal,
        debugPort,
        debugMode,
        debugModeInheritBreak,
      });
      const execArgv = ExecOptions.toExecArgv({
        ...childExecOptions,
        ...ExecOptions.fromExecArgv(commandLineOptions),
      });
      const envForChildProcess = {
        ...(inheritProcessEnv ? process.env : {}),
        ...env,
      };
      logger[logProcessCommand ? "info" : "debug"](
        `${process.argv[0]} ${execArgv.join(" ")} ${fileURLToPath(
          CONTROLLED_CHILD_PROCESS_URL,
        )}`,
      );
      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
      const childProcess = fork(fileURLToPath(CONTROLLED_CHILD_PROCESS_URL), {
        execArgv,
        // silent: true,
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: envForChildProcess,
      });
      logger.debug(
        createDetailedMessage(
          `child process forked (pid ${childProcess.pid})`,
          {
            "custom env": JSON.stringify(env, null, "  "),
          },
        ),
      );
      // if we pass stream, pipe them https://github.com/sindresorhus/execa/issues/81
      if (typeof stdin === "object") {
        stdin.pipe(childProcess.stdin);
      }
      if (typeof stdout === "object") {
        childProcess.stdout.pipe(stdout);
      }
      if (typeof stderr === "object") {
        childProcess.stderr.pipe(stderr);
      }
      const childProcessReadyPromise = new Promise((resolve) => {
        const removeReadyListener = onChildProcessMessage(
          childProcess,
          "ready",
          () => {
            removeReadyListener();
            onRuntimeStarted();
            resolve();
          },
        );
      });
      cleanupCallbackSet.add(
        onceChildProcessEvent(childProcess, "exit", () => {
          onRuntimeStopped();
        }),
      );

      const removeOutputListener = installChildProcessOutputListener(
        childProcess,
        ({ type, text }) => {
          if (type === "error" && text.startsWith("Debugger attached.")) {
            return;
          }
          if (
            type === "error" &&
            text.startsWith("Waiting for the debugger to disconnect...")
          ) {
            return;
          }

          onConsole({ type, text });
        },
      );
      const stop = memoize(async ({ gracefulStopAllocatedMs } = {}) => {
        // read all stdout before terminating
        // (no need for stderr because it's sync)
        if (collectConsole || onConsole) {
          while (childProcess.stdout.read() !== null) {}
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
        }

        // all libraries are facing problem on windows when trying
        // to kill a process spawning other processes.
        // "killProcessTree" is theorically correct but sometimes keep process handing forever.
        // Inside GitHub workflow the whole Virtual machine gets unresponsive and ends up being killed
        // There is no satisfying solution to this problem so we stick to the basic
        // childProcess.kill()
        if (process.platform === "win32") {
          childProcess.kill();
          return;
        }
        if (gracefulStopAllocatedMs) {
          try {
            await killProcessTree(childProcess.pid, {
              signal: GRACEFUL_STOP_SIGNAL,
              timeout: gracefulStopAllocatedMs,
            });
            return;
          } catch (e) {
            if (e.code === "TIMEOUT") {
              logger.debug(
                `kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`,
              );
              await killProcessTree(childProcess.pid, {
                signal: GRACEFUL_STOP_FAILED_SIGNAL,
              });
              return;
            }
            throw e;
          }
        }
        await killProcessTree(childProcess.pid, { signal: STOP_SIGNAL });
        return;
      });

      const result = {
        status: "executing",
        errors: [],
        namespace: null,
        timings: {},
        memoryUsage: null,
        performance: null,
      };

      try {
        let executionInternalErrorCallback;
        let executionCompletedCallback;
        const winnerPromise = new Promise((resolve) => {
          raceCallbacks(
            {
              aborted: (cb) => {
                return actionOperation.addAbortCallback(cb);
              },
              // https://nodejs.org/api/child_process.html#child_process_event_disconnect
              // disconnect: (cb) => {
              //   return onceProcessEvent(childProcess, "disconnect", cb)
              // },
              // https://nodejs.org/api/child_process.html#child_process_event_error
              error: (cb) => {
                return onceChildProcessEvent(childProcess, "error", cb);
              },
              exit: (cb) => {
                return onceChildProcessEvent(
                  childProcess,
                  "exit",
                  (code, signal) => {
                    cb({ code, signal });
                  },
                );
              },
              execution_internal_error: (cb) => {
                executionInternalErrorCallback = cb;
              },
              execution_completed: (cb) => {
                executionCompletedCallback = cb;
              },
            },
            resolve,
          );
        });
        const raceHandlers = {
          aborted: () => {
            result.status = "aborted";
          },
          error: (error) => {
            removeOutputListener();
            result.status = "failed";
            result.errors.push(error);
          },
          exit: ({ code }) => {
            onRuntimeStopped();
            if (code === 12) {
              result.status = "failed";
              result.errors.push(
                new Error(
                  `node process exited with 12 (the forked child process wanted to use a non-available port for debug)`,
                ),
              );
              return;
            }
            if (code === null || code === 0) {
              result.status = "completed";
              result.namespace = {};
              return;
            }
            if (
              code === EXIT_CODES.SIGINT ||
              code === EXIT_CODES.SIGTERM ||
              code === EXIT_CODES.SIGABORT
            ) {
              result.status = "failed";
              result.errors.push(
                new Error(`node process exited during execution`),
              );
              return;
            }
            // process.exit(1) in child process or process.exitCode = 1 + process.exit()
            // means there was an error even if we don't know exactly what.
            result.status = "failed";
            result.errors.push(
              new Error(
                `node process exited with code ${code} during execution`,
              ),
            );
          },
          execution_internal_error: (error) => {
            result.status = "failed";
            result.errors.push(error);
          },
          execution_completed: ({
            status,
            errors,
            namespace,
            timings,
            memoryUsage,
            performance,
            coverage,
          }) => {
            result.status = status;
            result.errors = errors;
            result.namespace = namespace;
            result.timings = timings;
            result.memoryUsage = memoryUsage;
            result.performance = performance;
            result.coverage = coverage;
          },
        };
        actionOperation.throwIfAborted();
        await childProcessReadyPromise;
        actionOperation.throwIfAborted();
        if (onMeasureMemoryAvailable) {
          onMeasureMemoryAvailable(async () => {
            let _resolve;
            const memoryUsagePromise = new Promise((resolve) => {
              _resolve = resolve;
            });
            await requestActionOnChildProcess(
              childProcess,
              {
                type: "measure-memory-usage",
              },
              ({ value }) => {
                _resolve(value);
              },
            );
            return memoryUsagePromise;
          });
        }
        await requestActionOnChildProcess(
          childProcess,
          {
            type: "execute-using-dynamic-import",
            params: {
              rootDirectoryUrl,
              fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
              measureMemoryUsage,
              collectPerformance,
              coverageEnabled,
              coverageInclude,
              coverageMethodForNodeJs,
              coverageFileUrl,
              exitAfterAction: true,
            },
          },
          ({ status, value }) => {
            if (status === "error") {
              executionInternalErrorCallback(value);
            } else {
              executionCompletedCallback(value);
            }
          },
        );
        const winner = await winnerPromise;
        raceHandlers[winner.name](winner.data);
      } catch (e) {
        result.status = "failed";
        result.errors.push(e);
      } finally {
        if (keepRunning) {
          stopSignal.notify = stop;
        } else {
          await stop({
            gracefulStopAllocatedMs,
          });
          onRuntimeStopped();
        }
        await actionOperation.end();
        await cleanup();
        return result;
      }
    },
  };
};

let previousId = 0;
const requestActionOnChildProcess = async (
  childProcess,
  { type, params },
  onResponse,
) => {
  const actionId = previousId + 1;
  previousId = actionId;

  const removeMessageListener = onChildProcessMessage(
    childProcess,
    "action-result",
    ({ id, ...payload }) => {
      if (id === actionId) {
        removeMessageListener();
        onResponse(payload);
      }
    },
  );

  const sendPromise = new Promise((resolve, reject) => {
    childProcess.send(
      {
        __jsenv__: "action",
        data: {
          id: actionId,
          type,
          params,
        },
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
  await sendPromise;
};

// http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472
const GRACEFUL_STOP_SIGNAL = "SIGTERM";
const STOP_SIGNAL = "SIGKILL";
// it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL
const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL";

const installChildProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = (chunk) => {
    callback({ type: "log", text: String(chunk) });
  };
  childProcess.stdout.on("data", stdoutDataCallback);
  const stdErrorDataCallback = (chunk) => {
    callback({ type: "error", text: String(chunk) });
  };
  childProcess.stderr.on("data", stdErrorDataCallback);
  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback);
    childProcess.stderr.removeListener("data", stdErrorDataCallback);
  };
};

const onChildProcessMessage = (childProcess, type, callback) => {
  const onmessage = (message) => {
    if (message && message.__jsenv__ === type) {
      callback(message.data ? JSON.parse(message.data) : "");
    }
  };
  childProcess.on("message", onmessage);
  return () => {
    childProcess.removeListener("message", onmessage);
  };
};

const onceChildProcessEvent = (childProcess, type, callback) => {
  childProcess.once(type, callback);
  return () => {
    childProcess.removeListener(type, callback);
  };
};
