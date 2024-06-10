import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("ref", {
  "reference removed": () => {
    const actual = {};
    const expect = {
      self: null,
    };
    expect.self = expect;
    assert({
      actual,
      expect,
    });
  },
  "reference added": () => {
    const actual = {
      self: null,
    };
    actual.self = actual;
    const expect = {};
    assert({
      actual,
      expect,
    });
  },
  "same ref to self": () => {
    const actual = {
      a: true,
      self: null,
    };
    actual.self = actual;
    const expect = {
      a: false,
      self: null,
    };
    expect.self = expect;
    assert({
      actual,
      expect,
    });
  },
  "ref changed": () => {
    const actual = {
      object: {
        self: null,
      },
    };
    actual.object.self = actual;
    const expect = {
      object: {
        self: null,
      },
    };
    expect.object.self = expect.object;
    assert({ actual, expect });
  },
  "true should be a ref to self": () => {
    const actual = {
      self: true,
    };
    const expect = {
      self: null,
    };
    expect.self = expect;
    assert({
      actual,
      expect,
    });
  },
  "ref to self should be true": () => {
    const actual = {
      self: null,
    };
    actual.self = actual;
    const expect = {
      self: true,
    };
    assert({
      actual,
      expect,
    });
  },
  // same_parent_ref: () => {
  //   const actual = {};
  //   actual.object = { parent: actual };
  //   const expected = {};
  //   expected.object = { parent: expected };
  //   assert({ actual, expected });
  // },
  // same_ref_twice: () => {
  //   const actual = {};
  //   actual.object = { self: actual, self2: actual };
  //   const expected = {};
  //   expected.object = { self: expected, self2: expected };
  //   assert({ actual, expected });
  // },
  // fail_should_not_be_a_reference_nested: () => {
  //   const actual = { object: {} };
  //   actual.object.self = {};
  //   const expected = { object: {} };
  //   expected.object.self = expected.object;
  //   assert({ actual, expected });
  // },
  ["true should be object using ref"]: () => {
    const item = { id: "a" };
    assert({
      actual: true,
      expect: {
        foo: item,
        bar: item,
      },
    });
  },
});
