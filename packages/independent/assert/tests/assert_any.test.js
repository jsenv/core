import { assert } from "@jsenv/assert";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("assert_any", ({ test }) => {
  test("10 and any(String)", () => {
    assert({
      actual: 10,
      expect: assert.any(String),
    });
  });
  test(`"foo" and any(String)`, () => {
    assert({
      actual: {
        a: true,
        b: "foo",
      },
      expect: {
        a: false,
        b: assert.any(String),
      },
    });
  });
  test(`"foo" and not(any(String))`, () => {
    assert({
      actual: "foo",
      expect: assert.not(assert.any(String)),
    });
  });
  test("10 is any Number", () => {
    assert({
      actual: {
        a: 10,
        b: true,
      },
      expect: {
        a: assert.any(Number),
        b: false,
      },
    });
  });
  test("0 is any number", () => {
    assert({
      actual: {
        a: 0,
        b: true,
      },
      expect: {
        a: assert.any(Number),
        b: false,
      },
    });
  });
  test("any Error", () => {
    assert({
      actual: {
        a: new Error(),
        b: true,
      },
      expect: {
        a: assert.any(Error),
        b: false,
      },
    });
  });
  //   any_array_cross_realm: async () => {
  //     assert({
  //       actual: await executeInNewContext("[]"),
  //       expect: assert.any(Array),
  //     });
  //   },
  //   any_string: () => {
  //     assert({
  //       actual: "foo",
  //       expect: assert.any(String),
  //     });
  //   },
  //   any_string_object: () => {
  //     assert({
  //       // eslint-disable-next-line no-new-wrappers
  //       actual: new String("foo"),
  //       expect: assert.any(String),
  //     });
  //   },
  //   any_regexp: () => {
  //     assert({
  //       actual: /yo/,
  //       expect: assert.any(RegExp),
  //     });
  //   },
  //   any_date: () => {
  //     assert({
  //       actual: new Date(),
  //       expect: assert.any(Date),
  //     });
  //   },
  //   any_error: () => {
  //     assert({
  //       actual: new Error(),
  //       expect: assert.any(Error),
  //     });
  //   },
  //   any_type_error: () => {
  //     assert({
  //       actual: new TypeError(),
  //       expect: assert.any(TypeError),
  //     });
  //   },
  //   any_error_on_type_error: () => {
  //     assert({
  //       actual: new TypeError(),
  //       expect: assert.any(Error),
  //     });
  //   },
  //   any_custom_instance: () => {
  //     class User {}
  //     assert({
  //       actual: new User(),
  //       expect: assert.any(User),
  //     });
  //   },
  //   fail_any_type_error_on_error: () => {
  //     assert({
  //       actual: new Error(),
  //       expect: assert.any(TypeError),
  //     });
  //   },
  //   fail_any_string_on_number: () => {
  //     assert({
  //       actual: 10,
  //       expect: assert.any(String),
  //     });
  //   },
  //   fail_any_stirng_on_boolean: () => {
  //     assert({
  //       actual: { token: true },
  //       expect: { token: assert.any(String) },
  //     });
  //   },
  //   fail_any_number_on_string: () => {
  //     assert({
  //       actual: [{ age: "dam" }],
  //       expect: [{ age: assert.any(Number) }],
  //     });
  //   },
  //   fail_custom_instance: () => {
  //     class User {}
  //     assert({
  //       actual: {},
  //       expect: assert.any(User),
  //     });
  //   },
});
