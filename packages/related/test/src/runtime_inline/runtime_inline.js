import { Abort, raceCallbacks } from "@jsenv/abort";

export const inlineRuntime = (fn) => {
  return {
    type: "inline",
    name: "inline",
    version: "1",
    run: async ({
      signal = new AbortController().signal,
      onRuntimeStarted,
      onRuntimeStopped,
    }) => {
      const actionOperation = Abort.startOperation();
      actionOperation.addAbortSignal(signal);
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
        try {
          onRuntimeStarted();
          const value = await fn();
          executionCompletedCallback(value);
        } catch (e) {
          executionInternalErrorCallback(e);
        }
        const raceHandlers = {
          aborted: () => {
            result.status = "aborted";
          },
          execution_internal_error: (e) => {
            result.status = "failed";
            result.errors.push(e);
          },
          execution_completed: (value) => {
            result.status = "completed";
            result.errors = [];
            result.namespace = value;
          },
        };
        const winner = await winnerPromise;
        raceHandlers[winner.name](winner.data);
      } finally {
        onRuntimeStopped();
        await actionOperation.end();
        return result;
      }
    },
  };
};
