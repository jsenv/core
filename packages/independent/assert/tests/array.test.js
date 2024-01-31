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
  // ["false should be an array"]: () => {
  //   assert({
  //     actual: false,
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
  ["diff on associate array.foo and object.foo"]: () => {
    const array = [];
    array.foo = true;
    assert({
      actual: array,
      expected: {
        foo: false,
      },
    });
  },
  // TODO:
  // - diff on deep property of array vs object
  // - diff on associate when array contains indexed values (now it's just on empty array)
  // and ensure the array length does not prevent the property diff to be displayed
  // - empty vs undefined
});
