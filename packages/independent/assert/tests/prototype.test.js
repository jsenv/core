import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("prototype", ({ test }) => {
  test("object null proto vs object", () => {
    assert({
      actual: Object.create(null),
      expect: {},
    });
  });
  test("object with different prototypes", () => {
    assert({
      actual: Object.create({ a: true }),
      expect: Object.create({ a: { b: true } }),
    });
  });
  test("object vs custom proto", () => {
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
  });
  test("object vs instance", () => {
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
  });
  test("null and Array.prototype", () => {
    assert({
      actual: null,
      expect: Array.prototype,
    });
  });
  test("Object.create(null) and []", () => {
    assert({
      actual: Object.create(null),
      expect: [],
    });
  });
});
