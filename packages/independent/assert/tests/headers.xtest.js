import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("headers", {
  ["content-type added"]: () => {
    assert({
      colors: false,
      actual: new Headers({
        "content-type": "text/xml",
      }),
      expect: new Headers(),
    });
  },
  // ["content-type removed"]: () => {
  //   assert({
  //     actual: new Headers({}),
  //     expect: new Headers({
  //       "content-type": "text/xml",
  //     }),
  //   });
  // },
  // ["content-type modified"]: () => {
  //   assert({
  //     actual: new Headers({
  //       "content-type": "text/css",
  //     }),
  //     expect: new Headers({
  //       "content-type": "text/xml",
  //     }),
  //   });
  // },
  // ["content-type multi added"]: () => {
  //   assert({
  //     actual: new Headers({
  //       "content-type": "text/xml, text/css",
  //     }),
  //     expect: new Headers({
  //       "content-type": "text/xml",
  //     }),
  //   });
  // },
});
