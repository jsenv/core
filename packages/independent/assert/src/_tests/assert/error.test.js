import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { executeInNewContext } from "../executeInNewContext.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("error", {
  basic: () => {
    assert({
      actual: new Error(),
      expected: new Error(),
    });
  },
  cross_realm: async () => {
    assert({
      actual: await executeInNewContext("new Error()"),
      expected: await executeInNewContext("new Error()"),
    });
  },
  cross_realm_b: async () => {
    assert({
      actual: await executeInNewContext("new Error()"),
      expected: new Error(),
    });
  },
  cross_realm_c: async () => {
    assert({
      actual: new Error(),
      expected: await executeInNewContext("new Error()"),
    });
  },
  fail_error_message: () => {
    assert({
      actual: new Error("foo"),
      expected: new Error("bar"),
    });
  },
  fail_error_prototype: () => {
    assert({
      actual: new Error(),
      expected: new TypeError(),
    });
  },
  // beware test below because depending on node version
  // Object.keys(Object.getPrototypeOf(new TypeError()))
  // might differ. For instance node 8.5 returns name before constructor
  // and node 8.9.0 returns constructor before name
  fail_error_cross_realm_prototype: async () => {
    assert({
      actual: new Error(),
      expected: await executeInNewContext("new TypeError()"),
    });
  },
});
