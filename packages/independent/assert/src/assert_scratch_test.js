import { startSnapshotTesting } from "../tests/start_snapshot_testing.js";
import { assert } from "./assert_scratch.js";

await startSnapshotTesting("assert_scratch", {
  ["property are different"]: () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: {
          b: true,
        },
      },
    });
  },
  ["property removed"]: () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: true,
        should_be_there: true,
      },
    });
  },
  ["property added"]: () => {
    assert({
      actual: {
        a: true,
        should_not_be_there: true,
      },
      expect: {
        a: true,
      },
    });
  },
  ["false should be an object"]: () => {
    assert({
      actual: false,
      expect: { foo: true },
    });
  },
  ["object should be false"]: () => {
    assert({
      actual: {
        foo: { a: {} },
      },
      expect: false,
    });
  },
  ["false should be an object at property"]: () => {
    assert({
      actual: {
        foo: false,
      },
      expect: {
        foo: { a: true },
      },
    });
  },
  ["object should be false at property"]: () => {
    assert({
      actual: {
        foo: { a: true },
      },
      expect: {
        foo: false,
      },
    });
  },
  ["max depth inside diff"]: () => {
    assert({
      actual: {
        foo: {
          foo_a: { foo_a2: { foo_a3: {} } },
          foo_b: { foo_b2: { foo_b3: {} } },
        },
        bar: true,
      },
      expect: {
        foo: {
          foo_a: { foo_a2: { foo_a3: {} } },
          foo_b: { foo_b2: { foo_b3: {} } },
        },
        bar: { bar_a: { bar_a2: {} } },
      },
      MAX_DEPTH: 2,
      MAX_DEPTH_INSIDE_DIFF: 1,
    });
  },
  ["max diff per object"]: () => {
    assert({
      actual: {
        a: true,
        b: {
          a: {
            y: true,
            z: true,
          },
        },
        c: true,
      },
      expect: {
        c: true,
        b: { a: false },
        a: true,
      },
      MAX_DIFF_PER_OBJECT: 2,
    });
  },
  ["max prop around diff"]: () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: true,
      },
      expect: {
        c: true,
        b: false,
        a: true,
      },
      MAX_PROP_BEFORE_DIFF: 0,
      MAX_PROP_AFTER_DIFF: 0,
    });
  },
  ["property should be there and is big"]: () => {
    assert({
      actual: {
        a: true,
      },
      expect: {
        a: true,
        should_be_there: {
          a: true,
          b: true,
          item: { a: 1, b: 1, c: 1 },
          c: true,
          d: true,
          e: true,
          f: true,
          g: true,
        },
      },
      MAX_COLUMNS: 100,
      MAX_DIFF_PER_OBJECT: 3,
    });
  },
  ["many props should not be there"]: () => {
    assert({
      actual: {
        a: true,
        b: true,
        c: { an_object: true, and: true },
        d: true,
        e: true,
        f: true,
        g: true,
        h: true,
      },
      expect: {
        a: true,
        c: {},
      },
    });
  },
  ["object vs user"]: () => {
    assert({
      actual: {},
      expect: {
        [Symbol.toStringTag]: "User",
      },
    });
  },
});

await startSnapshotTesting("wrapped_value", {
  ["10 vs Object(10)"]: () => {
    assert({
      actual: 10,
      expect: {
        valueOf: () => 10,
      },
    });
  },
  ["Object(10) vs 10"]: () => {
    assert({
      actual: {
        valueOf: () => 10,
      },
      expect: 10,
    });
  },
  ["Object({ a: true }) vs { a: true }"]: () => {
    assert({
      actual: {
        valueOf: () => {
          return { a: true };
        },
      },
      expect: { a: false },
    });
  },
});

// TODO: at property when rendered on single line
await startSnapshotTesting("max_columns", {
  ["at property value"]: () => {
    assert({
      actual: {
        foo: "abcdefghijklmn",
      },
      expect: {
        foo: "ABCDEFGHIJKLMN",
      },
      MAX_COLUMNS: 20,
    });
  },
  ["at property key"]: () => {
    assert({
      actual: {
        "a quite long property key that will be truncated": true,
      },
      expect: {
        "a quite long property key that will be truncated": false,
      },
      MAX_COLUMNS: 40,
    });
  },
  ["at property name last char"]: () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 10,
    });
  },
  ["at property name separator"]: () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 11,
    });
  },
  ["at space after property name separator"]: () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 12,
    });
  },
  ["at property value first char"]: () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 13,
    });
  },
  ["at property value second char"]: () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 14,
    });
  },
  ["at property value third char"]: () => {
    assert({
      actual: {
        abcdefgh: true,
      },
      expect: {
        abcdefgh: false,
      },
      MAX_COLUMNS: 15,
    });
  },
});
