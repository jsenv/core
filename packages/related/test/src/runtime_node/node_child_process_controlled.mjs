import { memoryUsage } from "node:process";

import { createException } from "../execution/exception.js";
import { executeUsingDynamicImport } from "./execute_using_dynamic_import.js";

let memoryHeapUsedAtStart;
if (process.env.MEASURE_MEMORY_AT_START) {
  global.gc();
  memoryHeapUsedAtStart = memoryUsage().heapUsed;
}

const ACTIONS_AVAILABLE = {
  "execute-using-dynamic-import": (params) => {
    return executeUsingDynamicImport(params);
  },
  "execute-using-require": async ({ fileUrl }) => {
    const result = {
      timings: {
        start: null,
        end: null,
      },
      namespace: null,
    };
    try {
      const { createRequire } = await import("node:module");
      const { fileURLToPath } = await import("node:url");
      const filePath = fileURLToPath(fileUrl);
      const require = createRequire(fileUrl);
      result.timings.start = Date.now();
      // eslint-disable-next-line import/no-dynamic-require
      const namespace = require(filePath);
      const namespaceResolved = {};
      await Promise.all(
        Object.keys(namespace).map(async (key) => {
          const value = await namespace[key];
          namespaceResolved[key] = value;
        }),
      );
      result.namespace = namespaceResolved;
    } finally {
      result.timings.end = Date.now();
      return result;
    }
  },
  "measure-memory-usage": () => {
    // we compare usage - usageAtstart to prevent
    // node or os specificities to have too much influences on the measures
    return memoryUsage().heapUsed - memoryHeapUsedAtStart;
  },
};

const sendToParent = (type, data) => {
  // https://nodejs.org/api/process.html#process_process_connected
  // not connected anymore, cannot communicate with parent
  if (!process.connected) {
    return;
  }
  // this can keep process alive longer than expected
  // when source is a long string.
  // It means node process may stay alive longer than expected
  // the time to send the data to the parent.
  process.send({
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
    process.removeListener("message", listener);
  };
  process.on("message", listener);
  return removeListener;
};

const removeActionRequestListener = onActionRequestedByParent(
  async ({ id, type, params = {} }) => {
    const sendActionFailed = (id, error) => {
      const exception = createException(error);
      sendToParent(
        "action-result",
        JSON.stringify({
          id,
          status: "failed",
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
      sendActionFailed(id, new Error(`unknown action ${type}`));
      return;
    }

    let value;
    let failed = false;
    try {
      value = await action(params);
    } catch (e) {
      failed = true;
      value = e;
    }

    if (failed) {
      sendActionFailed(id, value);
    } else {
      sendActionCompleted(id, value);
    }
    if (params.exitAfterAction) {
      removeActionRequestListener();
    }
  },
);

// remove listener to process.on('message')
// which is sufficient to let child process die
// assuming nothing else keeps it alive
// process.once("SIGTERM", removeActionRequestListener)
// process.once("SIGINT", removeActionRequestListener)

setTimeout(() => {
  sendToParent("ready");
});
