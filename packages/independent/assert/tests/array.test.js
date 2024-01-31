import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("array", {
  // ["object expected, array received"]: () => {
  //   assert({
  //     actual: [],
  //     expected: {},
  //   });
  // },
  // ["array expected, object received"]: () => {
  //   assert({
  //     actual: {},
  //     expected: [],
  //   });
  // },
  ["associative array expected, object received"]: () => {
    const array = [];
    array.foo = true;
    assert({
      actual: array,
      expected: {
        foo: true,
      },
    });
  },
  // ["diff on associate array.foo and object.foo"]: () => {
  //   const array = [];
  //   array.foo = true;
  //   assert({
  //     actual: array,
  //     expected: {
  //       foo: false,
  //     },
  //   });
  // },
});
