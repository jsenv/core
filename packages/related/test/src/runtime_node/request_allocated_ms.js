/*
 * Called from a test file to tell the test runner how much time this file needs:
 *
 *   import { requestAllocatedMs } from "@jsenv/test";
 *
 *   requestAllocatedMs(90_000);
 *
 * The request is sent to the process running the test plan, which restarts the
 * timeout with the requested duration and remembers it: a file asking for more
 * time than the others is also a file worth starting early when parallelizing.
 *
 * Node.js runtimes only; a browser has no channel to reach the test plan while
 * the file is executing.
 */

import { parentPort } from "node:worker_threads";

export const requestAllocatedMs = (ms) => {
  if (typeof ms !== "number") {
    throw new TypeError(`requestAllocatedMs expects a number, got ${ms}`);
  }
  const message = {
    __jsenv__: "allocated-ms-request",
    data: JSON.stringify({ ms }),
  };
  if (parentPort) {
    parentPort.postMessage(message);
    return;
  }
  if (process.send && process.connected) {
    process.send(message);
    return;
  }
  // file executed on its own (node ./file.test.mjs): there is no allocated time
};
