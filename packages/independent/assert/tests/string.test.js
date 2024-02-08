import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("string", {
  ["string single char"]: () => {
    assert({
      actual: "a",
      expected: "b",
    });
  },
  // ["diff end of string"]: () => {
  //   assert({
  //     actual: "hello world",
  //     expected: "hello france",
  //   });
  // },
  // ["diff unicode"]: () => {
  //   assert({
  //     actual: "⚫️",
  //     expected: "⚪️",
  //   });
  // },
  // ["diff emoticon"]: () => {
  //   assert({
  //     actual: "👨‍👩‍👧‍👧",
  //     expected: "😍",
  //   });
  // },
});
