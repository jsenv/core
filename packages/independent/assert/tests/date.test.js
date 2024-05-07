// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
//  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("date", {
  [`"0" and 70/01/01`]: () => {
    assert({
      actual: "0",
      expect: "70/01/01",
    });
  },
  ["01 Jan 1970 00:00:00 GMT and 04 Dec 1995 00:12:00 GMT"]: () => {
    assert({
      actual: "01 Jan 1970 00:00:00 GMT",
      expect: "04 Dec 1995 00:12:00 GMT",
    });
  },
});
