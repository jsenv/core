// https://github.com/avajs/ava/blob/576f534b345259055c95fa0c2b33bef10847a2af/lib/fork.js#L23
// https://nodejs.org/api/worker_threads.html
// https://github.com/avajs/ava/blob/576f534b345259055c95fa0c2b33bef10847a2af/lib/worker/base.js
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { Abort, raceCallbacks } from "@jsenv/abort";
import { memoize } from "@jsenv/utils/src/memoize/memoize.js";

import { createChildExecOptions } from "./child_exec_options.js";
import { ExecOptions } from "./exec_options.js";
import { EXIT_CODES } from "./exit_codes.js";
import { IMPORTMAP_NODE_LOADER_FILE_URL } from "./importmap_node_loader_file_url.js";
import { NO_EXPERIMENTAL_WARNING_FILE_URL } from "./no_experimental_warnings_file_url.js";

const CONTROLLED_WORKER_THREAD_URL = new URL(
  "./node_worker_thread_controlled.mjs?entry_point",
  import.meta.url,
).href;

export const nodeWorkerThread = ({
  importMap,
  env,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  inheritProcessEnv = true,
  commandLineOptions = [],
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
    name: "node_worker_thread",
    version: process.version.slice(1),
    run: async ({
      signal = new AbortController().signal,
      // logger,
      rootDirectoryUrl,
      fileRelativeUrl,

      keepRunning,
      stopSignal,
      onConsole,
      onRuntimeStarted,
      onRuntimeStopped,

      measureMemoryUsage,
      collectConsole = false,
      collectPerformance,
      coverageEnabled = false,
      coverageConfig,
      coverageMethodForNodeJs,
      coverageFileUrl,
    }) => {
      if (coverageMethodForNodeJs !== "NODE_V8_COVERAGE") {
        env.NODE_V8_COVERAGE = "";
      }
      if (importMap) {
        env.IMPORT_MAP = JSON.stringify(importMap);
        env.IMPORT_MAP_BASE_URL = rootDirectoryUrl;
        commandLineOptions.push(`--import=${IMPORTMAP_NODE_LOADER_FILE_URL}`);
        commandLineOptions.push(
          `--require=${fileURLToPath(NO_EXPERIMENTAL_WARNING_FILE_URL)}`,
        );
      }

      const workerThreadExecOptions = await createChildExecOptions({
        signal,
        debugPort,
        debugMode,
        debugModeInheritBreak,
      });
      const execArgvForWorkerThread = ExecOptions.toExecArgv({
        ...workerThreadExecOptions,
        ...ExecOptions.fromExecArgv(commandLineOptions),
      });
      const envForWorkerThread = {
        ...(inheritProcessEnv ? process.env : {}),
        ...env,
      };

      const cleanupCallbackSet = new Set();
      const cleanup = async (reason) => {
        const promises = [];
        for (const cleanupCallback of cleanupCallbackSet) {
          promises.push(cleanupCallback({ reason }));
        }
        cleanupCallbackSet.clear();
        await Promise.all(promises);
      };

      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
      // https://nodejs.org/api/worker_threads.html#new-workerfilename-options
      const workerThread = new Worker(
        fileURLToPath(CONTROLLED_WORKER_THREAD_URL),
        {
          env: envForWorkerThread,
          execArgv: execArgvForWorkerThread,
          // workerData: { options },
          stdin: true,
          stdout: true,
          stderr: true,
        },
      );
      const removeOutputListener = installWorkerThreadOutputListener(
        workerThread,
        ({ type, text }) => {
          onConsole({ type, text });
        },
      );
      const workerThreadReadyPromise = new Promise((resolve) => {
        onceWorkerThreadMessage(workerThread, "ready", () => {
          onRuntimeStarted();
          resolve();
        });
      });
      cleanupCallbackSet.add(
        onceWorkerThreadEvent(workerThread, "exit", () => {
          onRuntimeStopped();
        }),
      );

      const stop = memoize(async () => {
        // read all stdout before terminating
        // (no need for stderr because it's sync)
        if (collectConsole) {
          while (workerThread.stdout.read() !== null) {}
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
        }
        await workerThread.terminate();
      });

      const result = {
        status: "executing",
        errors: [],
        namespace: null,
        timings: {},
        memoryUsage: null,
        performance: null,
      };
      const winnerPromise = new Promise((resolve) => {
        raceCallbacks(
          {
            aborted: (cb) => {
              return actionOperation.addAbortCallback(cb);
            },
            error: (cb) => {
              return onceWorkerThreadEvent(workerThread, "error", cb);
            },
            exit: (cb) => {
              return onceWorkerThreadEvent(
                workerThread,
                "exit",
                (code, signal) => {
                  cb({ code, signal });
                },
              );
            },
            response: (cb) => {
              return onceWorkerThreadMessage(workerThread, "action-result", cb);
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
              new Error(`node worker thread exited during execution`),
            );
            return;
          }
          // process.exit(1) in child process or process.exitCode = 1 + process.exit()
          // means there was an error even if we don't know exactly what.
          result.status = "failed";
          result.errors.push(
            new Error(
              `node worker thread exited with code ${code} during execution`,
            ),
          );
        },
        response: ({ status, value }) => {
          if (status === "action-failed") {
            result.status = "failed";
            result.errors.push(value);
            return;
          }
          const { namespace, performance, coverage } = value;
          result.status = "completed";
          result.namespace = namespace;
          result.performance = performance;
          result.coverage = coverage;
        },
      };

      try {
        actionOperation.throwIfAborted();
        await workerThreadReadyPromise;
        actionOperation.throwIfAborted();
        await sendToWorkerThread(workerThread, {
          type: "action",
          data: {
            actionType: "execute-using-dynamic-import",
            actionParams: {
              rootDirectoryUrl,
              fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
              measureMemoryUsage,
              collectPerformance,
              coverageEnabled,
              coverageConfig,
              coverageMethodForNodeJs,
              coverageFileUrl,
              exitAfterAction: true,
            },
          },
        });
        const winner = await winnerPromise;
        raceHandlers[winner.name](winner.data);
      } catch (e) {
        result.status = "failed";
        result.errors.push(e);
      } finally {
        if (keepRunning) {
          stopSignal.notify = stop;
        } else {
          await stop();
        }
        await actionOperation.end();
        await cleanup();
        return result;
      }
    },
  };
};

const installWorkerThreadOutputListener = (workerThread, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = (chunk) => {
    const text = String(chunk);
    callback({ type: "log", text });
  };
  workerThread.stdout.on("data", stdoutDataCallback);
  const stdErrorDataCallback = (chunk) => {
    const text = String(chunk);
    callback({ type: "error", text });
  };
  workerThread.stderr.on("data", stdErrorDataCallback);
  return () => {
    workerThread.stdout.removeListener("data", stdoutDataCallback);
    workerThread.stderr.removeListener("data", stdErrorDataCallback);
  };
};

const sendToWorkerThread = (worker, { type, data }) => {
  worker.postMessage({ jsenv: true, type, data });
};

const onceWorkerThreadMessage = (workerThread, type, callback) => {
  const onmessage = (message) => {
    if (message && message.jsenv && message.type === type) {
      workerThread.removeListener("message", onmessage);
      callback(message.data ? JSON.parse(message.data) : undefined);
    }
  };
  workerThread.on("message", onmessage);
  return () => {
    workerThread.removeListener("message", onmessage);
  };
};

const onceWorkerThreadEvent = (worker, type, callback) => {
  worker.once(type, callback);
  return () => {
    worker.removeListener(type, callback);
  };
};
