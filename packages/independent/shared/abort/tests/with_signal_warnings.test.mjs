/*
 * By default Node.js emits a warning when there is more than 10 listeners
 * for "abort" on abortSignal.
 *
 * However if you want to perform 20 https request in parallel
 * this warning is annoying.
 * This test is compose of 2 parts:
 * 1. Shows code example trigerring Node.js warning
 * 2. How to use "withSignal" to avoid the warning
 *
 * UPDATE: not as useful since https://github.com/nodejs/node/pull/55816
 */

import { assert } from "@jsenv/assert";
import { setMaxListeners } from "node:events";

import { Abort } from "@jsenv/abort";
import { spyProcessWarnings } from "@jsenv/abort/tests/process_warnings_spy.mjs";

const getLimitedAbortController = () => {
  const abortController = new AbortController();
  setMaxListeners(10, abortController.signal);
  return abortController;
};

const fakeFetch = async ({ signal }) => {
  return new Promise((resolve, reject) => {
    const abortEventListener = () => {
      reject(new Error("Operation aborted"));
    };
    signal.addEventListener("abort", abortEventListener);

    setTimeout(() => {
      signal.removeEventListener("abort", abortEventListener);
      resolve();
    }, 100);
  });
};

// Node.js emits a warning when more than 10 listeners on "abort"
{
  const getProcessWarnings = spyProcessWarnings();
  const abortController = getLimitedAbortController();

  await Promise.all(
    new Array(11).fill("").map(async () => {
      await fakeFetch({ signal: abortController.signal });
    }),
  );

  const actual = getProcessWarnings();
  const expect = [
    Object.assign(
      new Error(
        `Possible EventTarget memory leak detected. 11 abort listeners added to [AbortSignal]. MaxListeners is 10. Use events.setMaxListeners() to increase limit`,
      ),
      {
        name: "MaxListenersExceededWarning",
        target: assert.any(Object),
        type: "abort",
        count: 11,
      },
    ),
  ];
  assert({ actual, expect });
}

// withSignal can be called any amount of time without trigerring a warning
// however the underlying api must still respect the limit of 10 signals
// best of both worlds: being able to opt-out from the memory leak warning because
// we know what we are doing, and preserves it for code not wrapped by
// "withSignal" which ensure the listener is removed
{
  const getProcessWarnings = spyProcessWarnings();
  const operation = Abort.startOperation();

  await Promise.all(
    new Array(11).fill("").map(async () => {
      await operation.withSignal(async (signal) => {
        await fakeFetch({ signal });
      });
    }),
  );

  const actual = getProcessWarnings();
  const expect = [];
  assert({ actual, expect });
}
