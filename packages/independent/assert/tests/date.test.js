// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

import { startSnapshotTesting } from "./start_snapshot_testing.js";

import { createAssert } from "../src/assert.js";

const assert = createAssert();

await startSnapshotTesting("date", {
  ["year month day minutes diff on iso"]: () => {
    assert({
      actual: "1970-01-01 00:00:00.000Z",
      expect: "1995-12-04 00:12:00.000Z",
    });
  },
  ["millisecond only diff on iso"]: () => {
    assert({
      actual: "1970-01-01 00:00:00.000Z",
      expect: "1970-01-01 00:00:00.020Z",
    });
  },
  ["+2 hour on timezone"]: () => {
    assert({
      actual: "1970-01-01 10:00:00+03:00",
      expect: "1970-01-01 10:00:00+01:00",
    });
  },
  ["-2 hour on timezone"]: () => {
    assert({
      actual: "1970-01-01 10:00:00-03:00",
      expect: "1970-01-01 10:00:00-01:00",
    });
  },
  ["+1h30 on timezone"]: () => {
    assert({
      actual: "1970-01-01 10:00:00+01:30",
      expect: "1970-01-01 10:00:00+00:00",
    });
  },
  ["-1h30 on timezone"]: () => {
    assert({
      actual: "1970-01-01 10:00:00-01:30",
      expect: "1970-01-01 10:00:00+00:00",
    });
  },
  ["+0h30 on timezone"]: () => {
    assert({
      actual: "1970-01-01 10:00:00+00:30",
      expect: "1970-01-01 10:00:00+00:00",
    });
  },
  ["GMT vs iso"]: () => {
    assert({
      actual:
        "Tue May 07 2024 11:27:04 GMT+0200 (Central European Summer Time)",
      expect: "1970-01-01 00:00:00Z",
    });
  },
  ["simplified date"]: () => {
    assert({
      actual: "1970-01-01 10:00:00",
      expect: "1970-01-01 10:00:00Z",
    });
  },
  ["date objects"]: () => {
    assert({
      actual: new Date("1970-01-01 10:00:00Z"),
      expect: new Date("1970-01-01 8:00:00Z"),
    });
  },
  ["date object vs date string"]: () => {
    assert({
      actual: new Date("1970-01-01 10:00:00Z"),
      expect: "1970-01-01 10:00:00Z",
    });
  },
  ["date object prop"]: () => {
    assert({
      actual: Object.assign(new Date("1970-01-01 10:00:00Z"), { foo: true }),
      expect: Object.assign(new Date("1970-01-01 10:00:00Z"), { foo: false }),
    });
  },
  [`incorrect date string`]: () => {
    assert({
      actual: "0",
      expect: "70/01/01",
    });
  },
});
