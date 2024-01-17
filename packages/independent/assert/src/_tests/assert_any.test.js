import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";
import { executeInNewContext } from "./utils/executeInNewContext.js";
import { assert } from "@jsenv/assert";

await startSnapshotTesting("assert_any", {
  any_array_cross_realm: async () => {
    assert({
      actual: await executeInNewContext("[]"),
      expected: assert.any(Array),
    });
  },
  any_string: () => {
    assert({
      actual: "foo",
      expected: assert.any(String),
    });
  },
  any_string_object: () => {
    assert({
      // eslint-disable-next-line no-new-wrappers
      actual: new String("foo"),
      expected: assert.any(String),
    });
  },
  any_regexp: () => {
    assert({
      actual: /yo/,
      expected: assert.any(RegExp),
    });
  },
  any_date: () => {
    assert({
      actual: new Date(),
      expected: assert.any(Date),
    });
  },
  any_error: () => {
    assert({
      actual: new Error(),
      expected: assert.any(Error),
    });
  },
  any_type_error: () => {
    assert({
      actual: new TypeError(),
      expected: assert.any(TypeError),
    });
  },
  any_error_on_type_error: () => {
    assert({
      actual: new TypeError(),
      expected: assert.any(Error),
    });
  },
  any_custom_instance: () => {
    class User {}
    assert({
      actual: new User(),
      expected: assert.any(User),
    });
  },
  fail_any_type_error_on_error: () => {
    assert({
      actual: new Error(),
      expected: assert.any(TypeError),
    });
  },
  fail_any_string_on_number: () => {
    assert({
      actual: 10,
      expected: assert.any(String),
    });
  },
  fail_any_stirng_on_boolean: () => {
    assert({
      actual: { token: true },
      expected: { token: assert.any(String) },
    });
  },
  fail_any_number_on_string: () => {
    assert({
      actual: [{ age: "dam" }],
      expected: [{ age: assert.any(Number) }],
    });
  },
  fail_custom_instance: () => {
    class User {}
    assert({
      actual: {},
      expected: assert.any(User),
    });
  },
});
