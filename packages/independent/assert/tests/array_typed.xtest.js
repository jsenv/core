import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("array_typed", {
  [`buffer.from("") vs buffer.from("a")`]: () => {
    assert({
      actual: Buffer.from(""),
      expect: Buffer.from("a"),
    });
  },
  [`buffer.from("a") vs buffer.from("")`]: () => {
    assert({
      actual: Buffer.from("a"),
      expect: Buffer.from(""),
    });
  },
  ["buffer without diff are collapsed"]: () => {
    assert({
      actual: {
        a: Buffer.from("a"),
        b: true,
      },
      expect: {
        a: Buffer.from("a"),
        b: false,
      },
    });
  },
  ["same length buffer diff at the end"]: () => {
    assert({
      actual: Buffer.from("hello, my name is dam"),
      expect: Buffer.from("hello, my name is daZ"),
    });
  },
  ["same length buffer diff at start"]: () => {
    assert({
      actual: Buffer.from("hello, my name is dam"),
      expect: Buffer.from("Zello, my name is dam"),
    });
  },
  ["same length buffer diff at middle"]: () => {
    assert({
      actual: Buffer.from("hello, my name is dam"),
      expect: Buffer.from("hello, my nZme is dam"),
    });
  },
  ["same length buffer diff start, middle, end"]: () => {
    assert({
      actual: Buffer.from("hello, my name is dam"),
      expect: Buffer.from("Zello, my nZme is daZ"),
    });
  },
  ["buffer vs string"]: () => {
    assert({
      actual: Buffer.from("a"),
      expect: "a",
    });
  },
  ["buffer vs array"]: () => {
    assert({
      actual: {
        a: Buffer.from("a"),
        b: Buffer.from("a"),
      },
      expect: {
        a: [97],
        b: [61],
      },
    });
  },
  ["buffer.from vs Uint8Array.from"]: () => {
    assert({
      actual: Buffer.from("a"),
      expect: Uint8Array.from([0x61]),
    });
  },
  ["Uint8Array vs Array"]: () => {
    assert({
      actual: Uint8Array,
      expect: Array,
    });
  },
});
