import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("property_descriptor", {
  //   ["non enumerable hidden when same"]: () => {
  //     const actual = { a: true };
  //     const expected = { a: false };
  //     Object.defineProperty(actual, "b", {
  //       enumerable: false,
  //       value: "b",
  //     });
  //     Object.defineProperty(expected, "b", {
  //       enumerable: false,
  //       value: "b",
  //     });
  //     assert({
  //       actual,
  //       expected,
  //     });
  //   },
  ["non enumerable displayed when modified"]: () => {
    const actual = {};
    const expected = {};
    Object.defineProperty(actual, "b", {
      enumerable: false,
      value: "b",
    });
    Object.defineProperty(expected, "b", {
      enumerable: false,
      value: "c",
    });
    assert({
      actual,
      expected,
    });
  },
});
