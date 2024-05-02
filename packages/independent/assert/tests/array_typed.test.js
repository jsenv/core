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
  ["buffer diff at the end of long buffer"]: () => {
    assert({
      actual: Buffer.from("hello, my name is dam"),
      expect: Buffer.from("hello, my name is dom"),
    });
  },
  // buffer vs string
  // buffer vs array
  // buffer vs uint8
});
