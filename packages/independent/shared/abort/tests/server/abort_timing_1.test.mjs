import { assert } from "@jsenv/assert";

import { Abort } from "@jsenv/abort";
import { startServer } from "./test_helpers.mjs";

const abortController = new AbortController();

try {
  const serverPromise = startServer({ signal: abortController.signal });
  abortController.abort();
  await serverPromise;
  throw new Error("should abort");
} catch (error) {
  const actual = Abort.isAbortError(error);
  const expect = true;
  assert({ actual, expect });
}
