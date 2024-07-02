import { assert } from "@jsenv/assert";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("prototype", ({ test }) => {
  test("Error vs TypeError", () => {
    assert({
      actual: new Error(),
      expect: new TypeError(),
    });
  });
  test("object with different prototypes", () => {
    assert({
      actual: Object.create({
        a: true,
      }),
      expect: Object.create({
        a: { b: true },
      }),
    });
  });
  test("Object.create(null) and {}", () => {
    assert({
      actual: Object.create(null),
      expect: {},
    });
  });
  test("Object.create(null) and []", () => {
    assert({
      actual: Object.create(null),
      expect: [],
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
});
