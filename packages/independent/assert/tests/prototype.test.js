import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("prototype", {
  ["object null proto vs object"]: () => {
    assert({
      actual: Object.create(null),
      expect: {},
    });
  },
  ["object with different prototypes"]: () => {
    assert({
      actual: Object.create({ a: true }),
      expect: Object.create({ a: { b: true } }),
    });
  },
  ["object vs custom proto"]: () => {
    const User = {
      [Symbol.toStringTag]: "User",
    };
    const dam = Object.create(User);
    dam.name = "dam";
    const bob = { name: "bob" };

    assert({
      actual: dam,
      expect: bob,
    });
  },
  ["object vs instance"]: () => {
    class User {}
    const dam = new User();
    dam.name = "dam";
    const bob = { name: "bob" };

    assert({
      actual: {
        a: dam,
      },
      expect: {
        a: bob,
      },
    });
  },
});
