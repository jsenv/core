import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("array", {
  ["array first item diff"]: () => {
    assert({
      actual: [true],
      expected: [false],
    });
  },
  /* eslint-disable no-sparse-arrays */
  ["undefined vs empty"]: () => {
    assert({
      actual: [,],
      expected: [undefined],
    });
  },
  ["empty added"]: () => {
    assert({
      actual: [,],
      expected: [],
    });
  },
  ["empty removed"]: () => {
    assert({
      actual: [],
      expected: [,],
    });
  },
  /* eslint-enable no-sparse-arrays */
  ["object expected, array received"]: () => {
    assert({
      actual: [],
      expected: {},
    });
  },
  ["false should be an array"]: () => {
    assert({
      actual: false,
      expected: [],
    });
  },
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
  ["diff on associate array deep property and object deep property"]: () => {
    const array = [];
    array.user = {
      name: "bob",
    };
    assert({
      actual: array,
      expected: {
        user: {
          name: "alice",
        },
      },
    });
  },
  ["array expected, object received"]: () => {
    assert({
      actual: {},
      expected: [],
    });
  },
  // TODO:
  // - diff on associate when array contains indexed values (now it's just on empty array)
  // and ensure the array length does not prevent the property diff to be displayed
});
