import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("assert_close_to", ({ test }) => {
  test("0.1 + 0.2 is close to 0.3", () => {
    assert({
      actual: {
        a: 0.1 + 0.2,
        b: true,
      },
      expect: {
        a: assert.closeTo(0.3),
        b: false,
      },
    });
  });
  test("on a string", () => {
    assert({
      actual: "toto",
      expect: assert.closeTo(0.4),
    });
  });
  test("0.3 and 0.4", () => {
    assert({
      actual: 0.1 + 0.2,
      expect: assert.closeTo(0.4),
    });
  });
});
