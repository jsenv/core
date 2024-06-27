import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("boolean", ({ test }) => {
  test("true should be false", () => {
    assert({
      actual: true,
      expect: false,
    });
  });
  test("false should be true", () => {
    assert({
      actual: false,
      expect: true,
    });
  });
  test("true should be 1", () => {
    assert({
      actual: true,
      expect: 1,
    });
  });
  test("false should be 0", () => {
    assert({
      actual: false,
      expect: 0,
    });
  });
});
