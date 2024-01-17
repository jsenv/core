import { startSnapshotTesting } from "./start_snapshot_testing.js";
import { executeInNewContext } from "../executeInNewContext.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("reference", {
  same_regexp: () => {
    assert({
      actual: /a/,
      expected: /a/,
    });
  },
  same_regexp_cross_realm: async () => {
    assert({ actual: await executeInNewContext("/a/"), expected: /a/ });
  },
  fail_regex_source: () => {
    assert({
      actual: /a/,
      expected: /b/,
    });
  },
  fail_regex_source_cross_realm: async () => {
    assert({
      actual: await executeInNewContext("/a/"),
      expected: /b/,
    });
  },
});
