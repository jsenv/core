import { assert } from "@jsenv/assert";

import { Abort } from "@jsenv/abort";

// when parent aborts, signal aborts
{
  const abortController = new AbortController();
  const operation = Abort.startOperation();
  operation.addAbortSignal(abortController.signal);

  let _resolve;
  let abortError = {};
  const withSignalPromise = operation.withSignal(async (signal) => {
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        reject(abortError);
      });
      _resolve = resolve;
    });
  });
  abortController.abort();
  _resolve(42);

  try {
    await withSignalPromise;
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expected = abortError;
    assert({ actual, expected });
  }
}
