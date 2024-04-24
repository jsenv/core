import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("weakset_and_weakmap", {
  ["weakset"]: () => {
    assert({
      actual: {
        a: true,
        b: new WeakSet([{}, [], Symbol.iterator]),
      },
      expect: {
        a: false,
        b: new WeakSet([Symbol.iterator]),
      },
    });
  },
  ["weakmap"]: () => {
    assert({
      actual: {
        a: true,
        b: new WeakMap([
          [{}, "object"],
          [[], "array"],
          [Symbol.iterator, { yes: true }],
        ]),
      },
      expect: {
        a: false,
        b: new WeakMap([[{}, "toto"]]),
      },
    });
  },
});
