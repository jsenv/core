import { parentPort } from "node:worker_threads";
import { memoryUsage } from "node:process";

import { createException } from "../execution/exception.js";
import { executeUsingDynamicImport } from "./execute_using_dynamic_import.js";

const ACTIONS_AVAILABLE = {
  "execute-using-dynamic-import": (params) => {
    return executeUsingDynamicImport(params);
  },
  "measure-memory-usage": () => {
    return memoryUsage().heapUsed;
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

setTimeout(() => {
  sendToParent("ready");
});
