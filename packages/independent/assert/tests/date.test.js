// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

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
  ["year month day minutes diff on iso UTC"]: () => {
    assert({
      actual: "1970-01-01 00:00:00.000Z",
      expect: "1995-12-04 00:12:00.000Z",
    });
  },
  ["millisecond only diff on iso UTC"]: () => {
    assert({
      actual: "1970-01-01 00:00:00.000Z",
      expect: "1970-01-01 00:00:00.020Z",
    });
  },
  // TODO: date objects
});
