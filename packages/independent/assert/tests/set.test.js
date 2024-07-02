import { assert } from "@jsenv/assert";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("set", {
  ["set value added"]: () => {
    assert({
      actual: new Set([
        "a",
        "b",
        "c",
        "d",
        // new
        "Y",
      ]),
      expect: new Set([
        "b",
        "a",
        "d",
        "c",
        // new
        "Z",
      ]),
      MAX_DIFF_INSIDE_VALUE: 4,
      MAX_CONTEXT_BEFORE_DIFF: 2,
    });
  },
  ["compare set and map"]: () => {
    assert({
      actual: new Map([[0, "a"]]),
      expect: new Set(["a"]),
    });
  },
  ["compare set and array"]: () => {
    assert({
      actual: ["a"],
      expect: new Set(["a"]),
    });
  },
  ["set collapsed various cases"]: () => {
    assert({
      actual: {
        a: true,
        set_without_diff: new Set(["a", "b"]),
        set_with_added: new Set(["a"]),
      },
      expect: {
        a: false,
        set_without_diff: new Set(["b", "a"]),
        set_with_added: new Set(["b"]),
      },
    });
  },
  ["set collapsed deep"]: () => {
    assert({
      actual: {
        a: {
          set_without_diff: new Set(["a", "b"]),
          set_with_added: new Set(["a"]),
        },
      },
      expect: {
        a: {
          set_without_diff: new Set(["b", "a"]),
          set_with_added: new Set(["b"]),
        },
      },
    });
  },
});
