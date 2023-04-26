import { parentPort } from "node:worker_threads";
import { uneval, executeUsingDynamicImport } from "./js/execute_using_dynamic_import.js";
import "node:fs";
import "node:inspector";
import "node:perf_hooks";

const ACTIONS_AVAILABLE = {
  "execute-using-dynamic-import": executeUsingDynamicImport
};
const ACTION_REQUEST_EVENT_NAME = "action";
const ACTION_RESPONSE_EVENT_NAME = "action-result";
const ACTION_RESPONSE_STATUS_FAILED = "action-failed";
const ACTION_RESPONSE_STATUS_COMPLETED = "action-completed";
const sendActionFailed = error => {
  if (error.hasOwnProperty("toString")) {
    delete error.toString;
  }
  sendToParent(ACTION_RESPONSE_EVENT_NAME,
  // process.send algorithm does not send non enumerable values
  // so use @jsenv/uneval
  uneval({
    status: ACTION_RESPONSE_STATUS_FAILED,
    value: error
  }, {
    ignoreSymbols: true
  }));
};
const sendActionCompleted = value => {
  sendToParent(ACTION_RESPONSE_EVENT_NAME,
  // here we use JSON.stringify because we should not
  // have non enumerable value (unlike there is on Error objects)
  // otherwise uneval is quite slow to turn a giant object
  // into a string (and value can be giant when using coverage)
  JSON.stringify({
    status: ACTION_RESPONSE_STATUS_COMPLETED,
    value
  }));
};
const sendToParent = (type, data) => {
  // this can keep process alive longer than expected
  // when source is a long string.
  // It means node process may stay alive longer than expected
  // the time to send the data to the parent.
  parentPort.postMessage({
    jsenv: true,
    type,
    data
  });
};
const onceParentMessage = (type, callback) => {
  const listener = message => {
    if (message && message.jsenv && message.type === type) {
      removeListener(); // commenting this line keep this worker alive
      callback(message.data);
    }
  };
  const removeListener = () => {
    parentPort.removeListener("message", listener);
  };
  parentPort.on("message", listener);
  return removeListener;
};
const removeActionRequestListener = onceParentMessage(ACTION_REQUEST_EVENT_NAME, async ({
  actionType,
  actionParams
}) => {
  const action = ACTIONS_AVAILABLE[actionType];
  if (!action) {
    sendActionFailed(new Error(`unknown action ${actionType}`));
    return;
  }
  let value;
  let failed = false;
  try {
    value = await action(actionParams);
  } catch (e) {
    failed = true;
    value = e;
  }
  if (failed) {
    sendActionFailed(value);
  } else {
    sendActionCompleted(value);
  }
  if (actionParams.exitAfterAction) {
    removeActionRequestListener();
  }
});
setTimeout(() => {
  sendToParent("ready");
});
