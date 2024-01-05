import { parentPort } from "node:worker_threads";
import { memoryUsage } from "node:process";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { createException } from "./js/exception.js";
import { executeUsingDynamicImport } from "./js/execute_using_dynamic_import.js";
import "node:fs";
import "node:inspector";
import "node:perf_hooks";

setFlagsFromString("--expose_gc");
global.gc = runInNewContext("gc");

let memoryHeapUsedAtStart;
if (process.env.MEASURE_MEMORY_AT_START) {
  global.gc();
  memoryHeapUsedAtStart = memoryUsage().heapUsed;
}

const ACTIONS_AVAILABLE = {
  "execute-using-dynamic-import": (params) => {
    return executeUsingDynamicImport(params);
  },
  "measure-memory-usage": () => {
    // we compare usage - usageAtstart to prevent
    // node or os specificities to have too much influences on the measures
    return memoryUsage().heapUsed - memoryHeapUsedAtStart;
  },
};

const sendToParent = (type, data) => {
  // this can keep process alive longer than expected
  // when source is a long string.
  // It means node process may stay alive longer than expected
  // the time to send the data to the parent.
  parentPort.postMessage({
    __jsenv__: type,
    data,
  });
};

const onActionRequestedByParent = (callback) => {
  const listener = (message) => {
    if (message && message.__jsenv__ === "action") {
      callback(message.data);
    }
  };
  const removeListener = () => {
    parentPort.removeListener("message", listener);
  };
  parentPort.on("message", listener);
  return removeListener;
};

const removeActionRequestListener = onActionRequestedByParent(
  async ({ id, type, params = {} }) => {
    const sendActionInternalError = (id, error) => {
      const exception = createException(error);
      sendToParent(
        "action-result",
        JSON.stringify({
          id,
          status: "error",
          value: exception,
        }),
      );
    };
    const sendActionCompleted = (id, value) => {
      sendToParent(
        "action-result",
        // here we use JSON.stringify because we should not
        // have non enumerable value (unlike there is on Error objects)
        // otherwise uneval is quite slow to turn a giant object
        // into a string (and value can be giant when using coverage)
        JSON.stringify({
          id,
          status: "completed",
          value,
        }),
      );
    };

    const action = ACTIONS_AVAILABLE[type];
    if (!action) {
      sendActionInternalError(id, new Error(`unknown action ${type}`));
      return;
    }

    let gotInternalError = false;
    const onUncaughtException = (err) => {
      gotInternalError = true;
      sendActionInternalError(id, err);
      process.exit(1);
    };
    process.on("uncaughtException", onUncaughtException);

    try {
      const value = await action(params);
      if (!gotInternalError) {
        sendActionCompleted(id, value);
      }
    } catch (e) {
      sendActionInternalError(id, e);
    } finally {
      process.removeListener("uncaughtException", onUncaughtException);
      if (params.exitAfterAction) {
        removeActionRequestListener();
      }
    }
  },
);

setTimeout(() => {
  sendToParent("ready");
});
