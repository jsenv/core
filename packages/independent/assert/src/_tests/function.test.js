import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("function", {
  anonymous_function: () => {
    const actual = (function () {
      return function () {};
    })();
    const expected = (function () {
      return function () {};
    })();
    assert({ actual, expected });
  },
  anonymous_arrow_function: () => {
    const actual = (function () {
      return () => {};
    })();
    const expected = (function () {
      return () => {};
    })();
    assert({ actual, expected });
  },
  fail_arrow_function_name: () => {
    const actual = () => {};
    const expected = () => {};
    assert({ actual, expected });
  },
});
