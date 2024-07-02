import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("assert_between", {
  "below or equals": () => {
    assert({
      actual: 50,
      expect: assert.belowOrEquals(25),
    });
  },
  "below or equals when removed": () => {
    assert({
      actual: {},
      expect: {
        a: assert.belowOrEquals(25),
      },
    });
  },
  "below or equals ok": () => {
    assert({
      actual: {
        a: true,
        b: 25,
      },
      expect: {
        a: false,
        b: assert.belowOrEquals(25),
      },
    });
  },
  "50 is too small": () => {
    assert({
      actual: 50,
      expect: assert.between(100, 200),
    });
  },
  // "250 is too big": () => {
  //   assert({
  //     actual: 42,
  //     expect: assert.not(100, 200),
  //   });
  // },
  // "string is not between 100,200": () => {
  //   assert({
  //     actual: "toto",
  //     expect: assert.between(100, 200),
  //   });
  // },
});
